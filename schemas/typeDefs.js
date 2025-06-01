import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { gql, useMutation, useQuery } from "@apollo/client";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { formatAmountInput } from "../helpers/formatAmount";

const GET_USER_BALANCE = gql`
  query Me {
    me {
      email
      name
      role
      saldo
    }
  }
`;

const TOP_UP_SALDO = gql`
  mutation TopUpSaldo($input: TopUpInput!) {
    topUpSaldo(input: $input) {
      transaction {
        user_id
        user {
          email
          name
          role
          saldo
        }
        transaction_id
        type
        payment_method
        amount
        status
        qr_code_url
      }
      payment_url
      qr_code
    }
  }
`;

const CONFIRM_PAYMENT = gql`
  mutation ConfirmPayment($transaction_id: String!) {
    confirmPayment(transaction_id: $transaction_id) {
      transaction_id
      status
      user {
        email
        name
        role
        saldo
      }
    }
  }
`;

// Expo Go compatible payment methods
const PAYMENT_METHODS = [
  {
    id: "ewallet",
    name: "E-Wallet",
    icon: "card-outline",
    providers: [
      {
        id: "gopay",
        name: "GoPay",
        image: "https://via.placeholder.com/200x50/00AA5B/FFFFFF?text=GoPay",
      },
      {
        id: "dana",
        name: "DANA",
        image: "https://via.placeholder.com/200x50/118EEA/FFFFFF?text=DANA",
      },
      {
        id: "ovo",
        name: "OVO",
        image: "https://via.placeholder.com/200x50/4C3494/FFFFFF?text=OVO",
      },
    ],
  },
  {
    id: "qris_demo",
    name: "QRIS Demo",
    icon: "qr-code-outline",
    providers: [
      {
        id: "qris_simulation",
        name: "QRIS Simulation",
        image: "https://via.placeholder.com/200x50/1E3A8A/FFFFFF?text=QRIS",
      },
    ],
  },
  {
    id: "bank_transfer",
    name: "Bank Transfer",
    icon: "business-outline",
    providers: [
      {
        id: "bca_va",
        name: "BCA Virtual Account",
        image: "https://via.placeholder.com/200x50/003D79/FFFFFF?text=BCA",
      },
      {
        id: "mandiri_va",
        name: "Mandiri Virtual Account",
        image: "https://via.placeholder.com/200x50/F57C00/FFFFFF?text=MANDIRI",
      },
    ],
  },
  {
    id: "test",
    name: "Testing",
    icon: "code-outline",
    providers: [
      {
        id: "dummy",
        name: "Dummy Payment (Testing)",
        image: "https://via.placeholder.com/200x50/FE7A3A/FFFFFF?text=TEST",
      },
    ],
  },
];

// Predefined top-up amounts - smaller amounts for testing
const AMOUNT_OPTIONS = [
  { value: 1000, label: "Rp 1.000" },
  { value: 5000, label: "Rp 5.000" },
  { value: 10000, label: "Rp 10.000" },
  { value: 25000, label: "Rp 25.000" },
];

export default function TopUpScreen() {
  const navigation = useNavigation();
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);

  // GraphQL queries and mutations
  const { data: userData, refetch: refetchBalance } =
    useQuery(GET_USER_BALANCE);
  const [topUpSaldo, { loading: topUpLoading }] = useMutation(TOP_UP_SALDO, {
    refetchQueries: [{ query: GET_USER_BALANCE }],
    awaitRefetchQueries: true,
  });
  const [confirmPayment] = useMutation(CONFIRM_PAYMENT);

  const currentBalance = userData?.me?.saldo || 0;

  const handleAmountSelect = (amount) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (text) => {
    const numericValue = text.replace(/[^0-9]/g, "");
    setCustomAmount(numericValue);
    setSelectedAmount(null);
  };

  const handlePaymentMethodSelect = (methodId) => {
    setSelectedPaymentMethod(methodId);
    setSelectedProvider(null);
  };

  const handleProviderSelect = (provider) => {
    setSelectedProvider(provider);
  };

  const getTopUpAmount = () => {
    if (selectedAmount) return selectedAmount;
    if (customAmount) return parseInt(customAmount, 10);
    return 0;
  };

  const updateSecureStoreBalance = async (newBalance) => {
    try {
      const userDataString = await SecureStore.getItemAsync("user_data");
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        userData.saldo = newBalance;
        await SecureStore.setItemAsync("user_data", JSON.stringify(userData));
      }
    } catch (error) {
      console.error("Error updating SecureStore balance:", error);
    }
  };

  const handleContinue = async () => {
    const amount = getTopUpAmount();

    if (!amount || amount < 1000) {
      Alert.alert(
        "Invalid Amount",
        "Please enter an amount of at least Rp 1,000"
      );
      return;
    }

    if (!selectedPaymentMethod || !selectedProvider) {
      Alert.alert("Payment Method Required", "Please select a payment method");
      return;
    }

    try {
      console.log("Starting top up with:", {
        amount,
        payment_method: selectedProvider.id,
      });

      const result = await topUpSaldo({
        variables: {
          input: {
            amount,
            payment_method: selectedProvider.id,
          },
        },
      });

      console.log("TopUp result:", result);

      if (!result?.data?.topUpSaldo) {
        throw new Error("Invalid response from server");
      }

      const { transaction, payment_url, qr_code } = result.data.topUpSaldo;

      if (!transaction) {
        throw new Error("Transaction not created");
      }

      // Handle different payment methods
      if (selectedProvider.id === "dummy") {
        // Dummy payment - immediate success
        const newBalance = transaction.user?.saldo || currentBalance + amount;
        await updateSecureStoreBalance(newBalance);

        Alert.alert(
          "Top Up Successful!",
          `Your balance has been increased by Rp ${formatAmountInput(
            amount
          )}. New balance: Rp ${formatAmountInput(newBalance)}`,
          [
            {
              text: "OK",
              onPress: () => navigation.navigate("HomeScreen"),
            },
          ]
        );
      } else if (selectedProvider.id === "qris_simulation") {
        // QRIS simulation - show QR code with simulate button
        navigation.navigate("QRISPaymentScreen", {
          transaction_id: transaction.transaction_id,
          amount,
          payment_method: selectedProvider.name,
          qr_code: qr_code,
          simulation: true,
        });
      } else if (selectedProvider.id.includes("_va")) {
        // Virtual Account - show VA number and instructions
        navigation.navigate("VirtualAccountScreen", {
          transaction_id: transaction.transaction_id,
          amount,
          payment_method: selectedProvider.name,
          bank: selectedProvider.id.split("_")[0].toUpperCase(),
          va_number: `8808${Date.now().toString().slice(-8)}`, // Mock VA number
        });
      } else if (["gopay", "dana", "ovo"].includes(selectedProvider.id)) {
        // E-wallet - open browser for payment
        if (payment_url) {
          Alert.alert(
            "E-Wallet Payment",
            `You will be redirected to ${selectedProvider.name} to complete the payment.`,
            [
              {
                text: "Cancel",
                style: "cancel",
              },
              {
                text: "Open App",
                onPress: async () => {
                  try {
                    const supported = await Linking.canOpenURL(payment_url);
                    if (supported) {
                      await Linking.openURL(payment_url);
                      // Navigate to waiting screen
                      navigation.navigate("PaymentWaitingScreen", {
                        transaction_id: transaction.transaction_id,
                        amount,
                        payment_method: selectedProvider.name,
                      });
                    } else {
                      Alert.alert("Error", "Cannot open payment URL");
                    }
                  } catch (error) {
                    console.error("Error opening URL:", error);
                    Alert.alert("Error", "Failed to open payment app");
                  }
                },
              },
            ]
          );
        } else {
          throw new Error("No payment URL received");
        }
      } else {
        throw new Error("Unsupported payment method");
      }
    } catch (error) {
      console.error("Top up error:", error);

      let errorMessage = "An error occurred during top up. Please try again.";

      if (error.message.includes("Cannot read property")) {
        errorMessage =
          "Server response error. Please check your connection and try again.";
      } else if (error.networkError) {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (error.graphQLErrors?.length > 0) {
        errorMessage = error.graphQLErrors[0].message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert("Top Up Failed", errorMessage);
    }
  };

  const handleConfirmPayment = async (transactionId) => {
    try {
      const result = await confirmPayment({
        variables: { transaction_id: transactionId },
      });

      console.log("Payment confirmation result:", result);

      if (result?.data?.confirmPayment) {
        const { status, user } = result.data.confirmPayment;
        const newBalance = user?.saldo || currentBalance;

        await updateSecureStoreBalance(newBalance);

        Alert.alert(
          "Payment Confirmed",
          `Your payment was successful. New balance: Rp ${formatAmountInput(
            newBalance
          )}`,
          [
            {
              text: "OK",
              onPress: () => navigation.navigate("HomeScreen"),
            },
          ]
        );
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      console.error("Payment confirmation error:", error);
      Alert.alert("Payment Confirmation Failed", "Please try again later.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
      >
        {/* Header */}
        <LinearGradient
          colors={["#FE7A3A", "#FF9A62"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Top Up Balance</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Current Balance</Text>
            <Text style={styles.balanceAmount}>
              Rp {formatAmountInput(currentBalance)}
            </Text>
          </View>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Amount Selection Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Amount</Text>

            <View style={styles.amountGrid}>
              {AMOUNT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.amountOption,
                    selectedAmount === option.value &&
                      styles.selectedAmountOption,
                  ]}
                  onPress={() => handleAmountSelect(option.value)}
                >
                  <Text
                    style={[
                      styles.amountOptionText,
                      selectedAmount === option.value &&
                        styles.selectedAmountOptionText,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.orText}>or enter custom amount:</Text>

            <View style={styles.customAmountContainer}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput
                style={styles.customAmountInput}
                placeholder="e.g. 150,000"
                keyboardType="number-pad"
                value={customAmount ? formatAmountInput(customAmount) : ""}
                onChangeText={handleCustomAmountChange}
              />
            </View>
          </View>

          {/* Payment Method Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>

            {PAYMENT_METHODS.map((method) => (
              <View key={method.id}>
                <TouchableOpacity
                  style={[
                    styles.paymentMethod,
                    selectedPaymentMethod === method.id &&
                      styles.selectedPaymentMethod,
                  ]}
                  onPress={() => handlePaymentMethodSelect(method.id)}
                >
                  <View style={styles.paymentMethodIcon}>
                    <Ionicons name={method.icon} size={24} color="#FE7A3A" />
                  </View>
                  <Text style={styles.paymentMethodName}>{method.name}</Text>
                  <Ionicons
                    name={
                      selectedPaymentMethod === method.id
                        ? "chevron-up"
                        : "chevron-down"
                    }
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>

                {selectedPaymentMethod === method.id && (
                  <View style={styles.providersContainer}>
                    {method.providers.map((provider) => (
                      <TouchableOpacity
                        key={provider.id}
                        style={[
                          styles.provider,
                          selectedProvider?.id === provider.id &&
                            styles.selectedProvider,
                        ]}
                        onPress={() => handleProviderSelect(provider)}
                      >
                        <Image
                          source={{ uri: provider.image }}
                          style={styles.providerImage}
                          resizeMode="contain"
                        />
                        <Text style={styles.providerName}>{provider.name}</Text>
                        {selectedProvider?.id === provider.id && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color="#FE7A3A"
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Summary Section */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Top Up Amount:</Text>
            <Text style={styles.summaryValue}>
              Rp {formatAmountInput(getTopUpAmount())}
            </Text>
          </View>

          {selectedProvider && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Payment Method:</Text>
              <Text style={styles.summaryValue}>{selectedProvider.name}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.continueButton,
              (!getTopUpAmount() ||
                !selectedPaymentMethod ||
                !selectedProvider ||
                topUpLoading) &&
                styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={
              !getTopUpAmount() ||
              !selectedPaymentMethod ||
              !selectedProvider ||
              topUpLoading
            }
          >
            {topUpLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.continueButtonText}>Continue to Payment</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  backButton: {
    padding: 5,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  balanceContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
  },
  balanceLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 5,
  },
  balanceAmount: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E3A8A",
    marginBottom: 15,
  },
  amountGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  amountOption: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  selectedAmountOption: {
    borderColor: "#FE7A3A",
    backgroundColor: "#FFF5F0",
  },
  amountOptionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4B5563",
  },
  selectedAmountOptionText: {
    color: "#FE7A3A",
  },
  orText: {
    color: "#6B7280",
    textAlign: "center",
    marginVertical: 15,
  },
  customAmountContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 15,
    height: 55,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4B5563",
    marginRight: 5,
  },
  customAmountInput: {
    flex: 1,
    fontSize: 16,
    color: "#1E293B",
    height: "100%",
  },
  paymentMethod: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 15,
    marginBottom: 10,
  },
  selectedPaymentMethod: {
    borderColor: "#FE7A3A",
    backgroundColor: "#FFF5F0",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  paymentMethodIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#FFF5F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  paymentMethodName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
  providersContainer: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#FE7A3A",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 15,
    paddingBottom: 15,
    marginBottom: 10,
  },
  provider: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  selectedProvider: {
    backgroundColor: "#FFF5F0",
  },
  providerImage: {
    width: 40,
    height: 25,
    marginRight: 15,
  },
  providerName: {
    flex: 1,
    fontSize: 15,
    color: "#4B5563",
  },
  summaryContainer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 5,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  continueButton: {
    backgroundColor: "#FE7A3A",
    borderRadius: 12,
    height: 55,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    shadowColor: "#FE7A3A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  continueButtonDisabled: {
    backgroundColor: "#BDBDBD",
    shadowOpacity: 0,
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});

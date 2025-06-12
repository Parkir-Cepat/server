import express from "express";
import crypto from "crypto";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";

const router = express.Router();

// Midtrans webhook handler
router.post("/midtrans", async (req, res) => {
  try {
    const notification = req.body;
    console.log("Webhook received:", notification);

    const {
      order_id,
      transaction_status,
      fraud_status,
      gross_amount,
      signature_key,
    } = notification;

    // Verify signature (optional but recommended)
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const hash = crypto
      .createHash("sha512")
      .update(order_id + "200" + gross_amount + serverKey)
      .digest("hex");

    // Find transaction
    const transaction = await Transaction.findByTransactionId(order_id);
    if (!transaction) {
      console.log("Transaction not found:", order_id);
      return res.status(404).json({ error: "Transaction not found" });
    }

    let newStatus = transaction.status;

    // Update status based on Midtrans response
    if (
      transaction_status === "capture" ||
      transaction_status === "settlement"
    ) {
      if (fraud_status === "accept" || !fraud_status) {
        newStatus = "success";
      }
    } else if (transaction_status === "pending") {
      newStatus = "pending";
    } else if (
      transaction_status === "deny" ||
      transaction_status === "expire" ||
      transaction_status === "cancel"
    ) {
      newStatus = "failed";
    }

    // Update transaction status
    const updatedTransaction = await Transaction.updateStatus(
      transaction._id,
      newStatus
    );

    // If successful top-up, update user balance
    if (newStatus === "success" && transaction.type === "top-up") {
      await User.updateSaldo(transaction.user_id, transaction.amount);

      // Create saldo credit record
      await Transaction.create({
        user_id: transaction.user_id,
        type: "saldo_credit",
        amount: transaction.amount,
        payment_method: "top-up",
        status: "success",
        transaction_id: transaction.transaction_id,
        description: "Top up saldo berhasil",
      });

      console.log(
        `Top-up success for user ${transaction.user_id}, amount: ${transaction.amount}`
      );
    }

    res.status(200).json({ status: "OK" });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;

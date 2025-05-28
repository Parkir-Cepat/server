import { connectDB } from '../config/db.js';
import { SaldoTransaction } from '../models/SaldoTransaction.js';
import { User } from '../models/User.js';

const fixTopUpTransaction = async () => {
  try {
    await connectDB();
    console.log('🔗 Connected to database');

    // Cari transaksi top up yang masih pending
    const orderId = 'TOP-1748412007734'; // Order ID terbaru dari check-transactions
    
    console.log(`🔍 Looking for transaction: ${orderId}`);
    const transaction = await SaldoTransaction.findByTransactionId(orderId);
    
    if (!transaction) {
      console.log('❌ Transaction not found');
      process.exit(1);
    }
    
    console.log('📊 Found transaction:', {
      id: transaction._id,
      userId: transaction.userId,
      amount: transaction.amount,
      status: transaction.status,
      type: transaction.type
    });
    
    if (transaction.status === 'success') {
      console.log('✅ Transaction already success, no action needed');
      process.exit(0);
    }
    
    // Update status menjadi success
    console.log('🔄 Updating transaction status to success...');
    const updated = await SaldoTransaction.updateStatusByTransactionId(orderId, 'success');
    
    if (updated) {
      console.log('✅ Transaction status updated successfully');
      
      // Update saldo user
      console.log(`💰 Adding ${transaction.amount} to user ${transaction.userId} balance...`);
      const userUpdate = await User.updateSaldo(transaction.userId, transaction.amount);
      
      if (userUpdate) {
        console.log('✅ User balance updated successfully');
        console.log('🎉 Top up fixed successfully!');
        
        // Tampilkan saldo user setelah update
        const updatedUser = await User.findById(transaction.userId);
        console.log(`💵 New user balance: ${updatedUser.saldo}`);
      } else {
        console.log('❌ Failed to update user balance');
      }
    } else {
      console.log('❌ Failed to update transaction status');
    }
    
  } catch (error) {
    console.error('❌ Error fixing top up:', error);
  } finally {
    process.exit(0);
  }
};

fixTopUpTransaction(); 
import { connectDB } from '../config/db.js';
import { getDB } from '../config/db.js';
import { SaldoTransaction } from '../models/SaldoTransaction.js';
import { User } from '../models/User.js';

const fixAllPendingTopUps = async () => {
  try {
    await connectDB();
    console.log('🔗 Connected to database');

    const db = getDB();
    
    // Ambil semua transaksi pending
    const pendingTransactions = await db.collection('saldoTransactions').find({ 
      status: 'pending',
      type: 'credit' // hanya top up
    }).toArray();
    
    if (pendingTransactions.length === 0) {
      console.log('✅ No pending top-up transactions found');
      process.exit(0);
    }
    
    console.log(`🔍 Found ${pendingTransactions.length} pending top-up transactions`);
    
    for (let i = 0; i < pendingTransactions.length; i++) {
      const trx = pendingTransactions[i];
      console.log(`\n${i + 1}. Processing transaction: ${trx.transactionId}`);
      console.log(`   Amount: ${trx.amount}, UserId: ${trx.userId}`);
      
      try {
        // Update status menjadi success
        const updated = await SaldoTransaction.updateStatusByTransactionId(trx.transactionId, 'success');
        
        if (updated) {
          console.log('   ✅ Status updated to success');
          
          // Update saldo user
          const userUpdate = await User.updateSaldo(trx.userId, trx.amount);
          
          if (userUpdate) {
            console.log(`   💰 Added ${trx.amount} to user balance`);
          } else {
            console.log('   ❌ Failed to update user balance');
          }
        } else {
          console.log('   ❌ Failed to update transaction status');
        }
      } catch (error) {
        console.log(`   ❌ Error processing transaction: ${error.message}`);
      }
    }
    
    // Tampilkan saldo user final
    const userId = pendingTransactions[0].userId; // Ambil userId dari transaksi pertama
    const finalUser = await User.findById(userId);
    console.log(`\n🎉 All pending transactions processed!`);
    console.log(`💵 Final user balance: ${finalUser.saldo}`);
    
  } catch (error) {
    console.error('❌ Error fixing pending transactions:', error);
  } finally {
    process.exit(0);
  }
};

fixAllPendingTopUps(); 
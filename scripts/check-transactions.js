import { connectDB } from '../config/db.js';
import { getDB } from '../config/db.js';

const checkTransactions = async () => {
  try {
    await connectDB();
    console.log('🔗 Connected to database');

    const db = getDB();
    
    // Ambil semua transaksi saldo
    console.log('📋 All saldo transactions:');
    const allTransactions = await db.collection('saldoTransactions').find({}).sort({ createdAt: -1 }).toArray();
    
    if (allTransactions.length === 0) {
      console.log('❌ No saldo transactions found');
    } else {
      allTransactions.forEach((trx, index) => {
        console.log(`${index + 1}. ID: ${trx._id}`);
        console.log(`   TransactionId: ${trx.transactionId}`);
        console.log(`   UserId: ${trx.userId}`);
        console.log(`   Type: ${trx.type}`);
        console.log(`   Amount: ${trx.amount}`);
        console.log(`   Status: ${trx.status}`);
        console.log(`   PaymentMethod: ${trx.paymentMethod}`);
        console.log(`   Created: ${trx.createdAt}`);
        console.log('   ---');
      });
    }
    
    // Cari transaksi pending
    console.log('\n🔍 Pending transactions:');
    const pendingTransactions = await db.collection('saldoTransactions').find({ status: 'pending' }).toArray();
    
    if (pendingTransactions.length === 0) {
      console.log('✅ No pending transactions found');
    } else {
      pendingTransactions.forEach((trx, index) => {
        console.log(`${index + 1}. TransactionId: ${trx.transactionId}, Amount: ${trx.amount}, UserId: ${trx.userId}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking transactions:', error);
  } finally {
    process.exit(0);
  }
};

checkTransactions(); 
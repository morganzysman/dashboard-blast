#!/usr/bin/env node

// PostgreSQL Setup and Migration Script
// Run this script to set up the database for OlaClick Analytics

import { runMigrations, getMigrationStatus, testConnection, createUser, closeDatabase } from './database.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import readline from 'readline';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

// Helper function to ask for password (hidden input)
function askPassword(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    
    stdout.write(question);
    
    stdin.setRawMode(true);
    stdin.resume();
    
    let password = '';
    
    stdin.on('data', function(char) {
      char = char.toString();
      
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          stdout.write('\n');
          process.exit();
          break;
        case '\u007f': // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          stdout.write('*');
          break;
      }
    });
  });
}

// Main setup function
async function setupPostgreSQL() {
  console.log('🚀 OlaClick Analytics PostgreSQL Setup');
  console.log('=====================================\n');
  
  try {
    // Test database connection
    console.log('1. Testing database connection...');
    const connectionResult = await testConnection();
    
    if (!connectionResult) {
      console.error('❌ Database connection failed!');
      console.log('\n📋 Setup Instructions:');
      console.log('1. Make sure PostgreSQL is installed and running');
      console.log('2. Create a database for the application');
      console.log('3. Set environment variables:');
      console.log('   DB_HOST=localhost');
      console.log('   DB_PORT=5432');
      console.log('   DB_NAME=olaclick_analytics');
      console.log('   DB_USER=your_username');
      console.log('   DB_PASSWORD=your_password');
      console.log('\n📝 Example .env file:');
      console.log('   DB_HOST=localhost');
      console.log('   DB_PORT=5432');
      console.log('   DB_NAME=olaclick_analytics');
      console.log('   DB_USER=postgres');
      console.log('   DB_PASSWORD=your_password');
      console.log('   VAPID_PUBLIC_KEY=your_vapid_public_key');
      console.log('   VAPID_PRIVATE_KEY=your_vapid_private_key');
      console.log('   VAPID_CONTACT_EMAIL=admin@yourdomain.com');
      console.log('   NODE_ENV=production');
      process.exit(1);
    }
    
    console.log('✅ Database connection successful!');
    
    // Run database migrations
    console.log('\n2. Running database migrations...');
    await runMigrations();
    console.log('✅ Database migrations completed successfully!');
    
    // Show migration status
    console.log('\n3. Migration Status:');
    const migrationStatus = await getMigrationStatus();
    console.log(`   Total migrations: ${migrationStatus.totalMigrations}`);
    console.log(`   Applied migrations: ${migrationStatus.appliedCount}`);
    console.log(`   Pending migrations: ${migrationStatus.pendingCount}`);
    
    if (migrationStatus.migrations.length > 0) {
      console.log('\n📋 Migration Details:');
      migrationStatus.migrations.forEach(migration => {
        const status = migration.applied ? '✅' : '⏳';
        const appliedText = migration.applied ? 
          `(applied ${migration.appliedAt ? migration.appliedAt.toISOString().split('T')[0] : 'unknown'})` : 
          '(pending)';
        console.log(`   ${status} ${migration.filename} ${appliedText}`);
      });
    }
    
    // Check if we should create an admin user
    console.log('\n4. Admin User Setup');
    const createAdmin = await askQuestion('Do you want to create an admin user? (y/n): ');
    
    if (createAdmin.toLowerCase() === 'y' || createAdmin.toLowerCase() === 'yes') {
      console.log('\n📝 Creating admin user...');
      
      const name = await askQuestion('Enter admin name: ');
      const email = await askQuestion('Enter admin email: ');
      const password = await askPassword('Enter admin password: ');
      
      if (!name || !email || !password) {
        console.log('❌ All fields are required for admin user creation');
      } else {
        try {
          const hashedPassword = await bcrypt.hash(password, 10);
          
          const adminUser = await createUser({
            email: email.toLowerCase(),
            name: name,
            role: 'admin',
            hashedPassword: hashedPassword,
            accounts: [], // Admin can be assigned accounts later
            timezone: 'America/Lima',
            currency: 'PEN',
            currencySymbol: 'S/'
          });
          
          console.log(`✅ Admin user created successfully!`);
          console.log(`   ID: ${adminUser.id}`);
          console.log(`   Email: ${adminUser.email}`);
          console.log(`   Name: ${adminUser.name}`);
          console.log(`   Role: ${adminUser.role}`);
        } catch (error) {
          if (error.code === '23505') { // Unique constraint violation
            console.log('❌ User with this email already exists');
          } else {
            console.error('❌ Error creating admin user:', error.message);
          }
        }
      }
    }
    
    // Show next steps
    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Start the server: npm start');
    console.log('2. Open your browser to: http://localhost:3001');
    console.log('3. Login with your admin credentials');
    console.log('4. Configure user accounts and OlaClick API tokens');
    
    console.log('\n🔧 Available Scripts:');
    console.log('   npm start          - Start the server');
    console.log('   npm run dev        - Start with file watching');
    console.log('   npm run production - Start in production mode');
    console.log('   npm run db:migrate - Run database migrations');
    console.log('   npm run db:status  - Check migration status');
    console.log('   npm run db:test    - Test database connection');
    
    console.log('\n🗂️  Migration Files Applied:');
    migrationStatus.migrations.filter(m => m.applied).forEach(migration => {
      console.log(`   ✅ ${migration.filename}`);
    });
    
    console.log('\n📊 Database Tables Created:');
    console.log('   ✅ migrations         - Migration tracking');
    console.log('   ✅ users              - User accounts and authentication');
    console.log('   ✅ user_sessions      - Session management');
    console.log('   ✅ push_subscriptions - Push notification subscriptions');
    console.log('   ✅ notification_logs  - Event logging and debugging');
    
    console.log('\n🔔 Push Notifications:');
    console.log('   - Default VAPID keys are provided for testing');
    console.log('   - For production, generate your own VAPID keys:');
    console.log('     npx web-push generate-vapid-keys');
    console.log('   - Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables');
    
    console.log('\n🔧 Migration System:');
    console.log('   - Migrations are stored in the migrations/ folder');
    console.log('   - Each migration is applied only once');
    console.log('   - Use npm run db:migrate to run pending migrations');
    console.log('   - Use npm run db:status to check migration status');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await closeDatabase();
    rl.close();
  }
}

// Check for command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('OlaClick Analytics PostgreSQL Setup');
  console.log('Usage: node setup-postgres.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h           Show this help message');
  console.log('  --migrate-only       Only run migrations, skip user creation');
  console.log('  --status             Show migration status');
  console.log('');
  console.log('Environment Variables:');
  console.log('  DB_HOST              PostgreSQL host (default: localhost)');
  console.log('  DB_PORT              PostgreSQL port (default: 5432)');
  console.log('  DB_NAME              Database name (default: olaclick_analytics)');
  console.log('  DB_USER              Database user (default: postgres)');
  console.log('  DB_PASSWORD          Database password (required)');
  console.log('  DB_SSL               Enable SSL (default: false)');
  console.log('');
  console.log('Migration Commands:');
  console.log('  npm run db:migrate   Run pending migrations');
  console.log('  npm run db:status    Check migration status');
  console.log('  npm run db:test      Test database connection');
  process.exit(0);
}

if (args.includes('--status')) {
  // Show migration status only
  console.log('🔍 Checking migration status...');
  
  try {
    const connectionResult = await testConnection();
    if (!connectionResult) {
      console.error('❌ Database connection failed!');
      process.exit(1);
    }
    
    const migrationStatus = await getMigrationStatus();
    console.log(`\n📊 Migration Status:`);
    console.log(`   Total migrations: ${migrationStatus.totalMigrations}`);
    console.log(`   Applied migrations: ${migrationStatus.appliedCount}`);
    console.log(`   Pending migrations: ${migrationStatus.pendingCount}`);
    
    if (migrationStatus.migrations.length > 0) {
      console.log('\n📋 Migration Details:');
      migrationStatus.migrations.forEach(migration => {
        const status = migration.applied ? '✅' : '⏳';
        const appliedText = migration.applied ? 
          `(applied ${migration.appliedAt ? migration.appliedAt.toISOString().split('T')[0] : 'unknown'})` : 
          '(pending)';
        console.log(`   ${status} ${migration.filename} ${appliedText}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking migration status:', error.message);
  } finally {
    await closeDatabase();
  }
} else if (args.includes('--migrate-only')) {
  // Only run migrations
  console.log('🚀 Running migrations only...');
  
  try {
    const connectionResult = await testConnection();
    if (!connectionResult) {
      console.error('❌ Database connection failed!');
      process.exit(1);
    }
    
    await runMigrations();
    console.log('✅ Migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await closeDatabase();
  }
} else {
  // Run full setup
  setupPostgreSQL();
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n\n🔄 Setup cancelled by user');
  try {
    await closeDatabase();
  } catch (error) {
    // Ignore cleanup errors
  }
  rl.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  try {
    await closeDatabase();
  } catch (error) {
    // Ignore cleanup errors
  }
  rl.close();
  process.exit(0);
}); 
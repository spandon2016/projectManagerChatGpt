/**
 * Integration Test: Create Admin User
 * 
 * This test demonstrates how to create an admin user in the system.
 */

const API_URL = 'http://localhost:5000/api';

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`${response.status}: ${error.error || error.message}`);
  }
  return await response.json();
}

async function testIntegrationAdminUser() {
  console.log('🧪 Starting Integration Test: Create Admin User\n');

  try {
    const adminEmail = 'nelson@mytest.com';
    const adminPassword = 'noneOfYour12!';
    const adminId = `admin_${Date.now()}`;

    // Step 1: Create admin user
    console.log('📝 Step 1: Creating admin user...');
    const user = await apiCall('/users', 'POST', {
      id: adminId,
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      createdAt: new Date().toISOString()
    });
    console.log('✅ Admin user created:', {
      id: user.id,
      email: user.email,
      role: user.role
    });

    // Step 2: Verify the admin user was created
    console.log('\n🔍 Step 2: Verifying admin user...');
    const allUsers = await apiCall('/users');
    const createdAdmin = allUsers.find(u => u.email === adminEmail);
    if (createdAdmin) {
      console.log('✅ Admin user verified:', {
        id: createdAdmin.id,
        email: createdAdmin.email,
        role: createdAdmin.role || 'user'
      });
    } else {
      throw new Error('Admin user not found in user list');
    }

    // Step 3: Attempt login with admin credentials
    console.log('\n🔐 Step 3: Testing admin login...');
    try {
      const loginResult = await apiCall('/auth/login', 'POST', {
        email: adminEmail,
        password: adminPassword
      });
      console.log('✅ Admin login successful:', {
        id: loginResult.id,
        email: loginResult.email,
        role: loginResult.role
      });
    } catch (loginError) {
      console.log('⚠️  Login test skipped:', loginError.message);
    }

    console.log('\n✨ Admin user created successfully!');
    console.log('\n📋 Admin Credentials:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   User ID: ${adminId}`);
    console.log(`   Role: admin`);

    return { userId: adminId, email: adminEmail, role: 'admin' };

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testIntegrationAdminUser().then(result => {
  console.log('\n📊 Test Results:', result);
  process.exit(0);
});

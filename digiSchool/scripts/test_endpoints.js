import sendEmailHandler from './api/send-email.js';
import sendMessageHandler from './api/send-message.js';

async function mockReqRes(handler, body, method = 'POST') {
  let responseData = null;
  let statusCode = 200;
  
  const req = {
    method,
    body
  };
  
  const res = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
    },
    end: () => {}
  };
  
  await handler(req, res);
  return { statusCode, responseData };
}

async function runTests() {
  console.log('Testing /api/send-email...');
  const res1 = await mockReqRes(sendEmailHandler, {
    email: 'test@example.com',
    username: 'testuser',
    password: 'password123',
    name: 'Test User',
    role: 'student',
    schoolName: 'Test School'
  });
  console.log('send-email response:', res1);

  console.log('\nTesting /api/send-message...');
  const res2 = await mockReqRes(sendMessageHandler, {
    email: 'test@example.com',
    name: 'Test Staff',
    subject: 'Test Subject',
    body: 'This is a test message',
    schoolName: 'Test School'
  });
  console.log('send-message response:', res2);

  // Test missing fields
  console.log('\nTesting /api/send-email with missing fields...');
  const res3 = await mockReqRes(sendEmailHandler, {
    email: 'test@example.com'
  });
  console.log('send-email (missing fields) response:', res3);
}

runTests().catch(console.error);

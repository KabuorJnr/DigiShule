const url = 'https://oblzjefrmtxcvbagvnrr.supabase.co/rest/v1/finance_payments?limit=1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibHpqZWZybXR4Y3ZiYWd2bnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTI2NDYsImV4cCI6MjA5NjQ4ODY0Nn0.lgN-r94YkTCsalky3lUjt7V-0uyRQUA0HX-9Hzj7jGU';

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
}).then(res => res.json()).then(data => {
  console.log(data);
}).catch(console.error);

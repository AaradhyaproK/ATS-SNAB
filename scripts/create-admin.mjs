import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] || 'Admin';

if (!email || !password) {
  console.log('\n❌ Usage: node scripts/create-admin.mjs <email> <password> [name]');
  console.log('   Example: node scripts/create-admin.mjs admin@snab.co.in MyPassword123 "Platform Admin"\n');
  process.exit(1);
}

async function createAdmin() {
  console.log(`\n🚀 Setting up Admin account for ${email} in Firebase project ats-1-7d621...`);

  let user;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    user = cred.user;
    console.log(`✅ Auth user created successfully! UID: ${user.uid}`);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      console.log(`ℹ️ User already exists in Auth. Signing in to verify credentials...`);
      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        user = cred.user;
        console.log(`✅ Signed in successfully! UID: ${user.uid}`);
      } catch (signErr) {
        console.error(`❌ Password incorrect for existing user:`, signErr.message);
        process.exit(1);
      }
    } else if (err.code === 'auth/operation-not-allowed') {
      console.error(`\n❌ Email/Password sign-in is not enabled in Firebase Console!`);
      console.error(`👉 Go to: https://console.firebase.google.com/project/ats-1-7d621/authentication/providers`);
      console.error(`   Click "Email/Password" -> Toggle "Enable" -> Click "Save".\n`);
      process.exit(1);
    } else {
      console.error(`❌ Failed to create auth user:`, err.message);
      process.exit(1);
    }
  }

  try {
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: email.trim().toLowerCase(),
      name: name,
      displayName: name,
      role: 'admin',
      adminVerified: true,
      emailVerified: true,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    await setDoc(doc(db, 'profiles', user.uid), {
      uid: user.uid,
      email: email.trim().toLowerCase(),
      name: name,
      role: 'admin',
      company: 'SNAB hireX'
    }, { merge: true });

    console.log(`✅ Firestore user & profile documents updated with role: "admin"!`);
    console.log(`\n🎉 Admin account is ready! You can now log in at:`);
    console.log(`   http://localhost:5173/#/auth (or your live app URL)`);
    console.log(`   Email: ${email}`);
    console.log(`   Role: admin\n`);
  } catch (dbErr) {
    console.error(`❌ Failed to write to Firestore:`, dbErr.message);
    if (dbErr.message.includes('permission-denied')) {
      console.error(`👉 Please ensure your Firestore Security Rules allow initial setup or write.`);
    }
  }
}

createAdmin().catch(console.error);

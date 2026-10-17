import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAsahVN3b4TfA_atPtKy8d5DPaJ0819F3w",
  authDomain: "ats-1-7d621.firebaseapp.com",
  projectId: "ats-1-7d621",
  storageBucket: "ats-1-7d621.firebasestorage.app",
  messagingSenderId: "331729790419",
  appId: "1:331729790419:web:dc5d5000bd95054c123b26",
  measurementId: "G-DRJXJB5154"
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

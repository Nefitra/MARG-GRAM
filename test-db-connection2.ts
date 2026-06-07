import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

async function diagnose() {
  try {
    const configPath = './firebase-applet-config.json';
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    admin.initializeApp({
      projectId: config.projectId,
    });

    console.log("Checking named database...");
    const dbNamed = getFirestore(admin.app(), config.firestoreDatabaseId);
    
    // Attempt write
    await dbNamed.collection('users').doc('14201337').set({
      test: true,
      updated_at: new Date().toISOString()
    }, { merge: true });
    
    console.log("Named DB Write Succeeded!");
    const docSnap = await dbNamed.collection('users').doc('14201337').get();
    console.log("Doc Read:", docSnap.data());
  } catch (error: any) {
    console.error("Named DB Failed:", error.message || error);
  }
  process.exit(0);
}

diagnose();

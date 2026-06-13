import { Storage } from '@google-cloud/storage';
import pg from 'postgres';

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

const sql = pg(process.env.DATABASE_URL);

async function makeAllWaitingScreensPublic() {
  try {
    console.log('Fetching all waiting screens...');
    const screens = await sql`SELECT * FROM waiting_screens`;
    
    console.log(`Found ${screens.length} waiting screens`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const screen of screens) {
      try {
        console.log(`\nProcessing: ${screen.video_name} (${screen.video_url})`);
        
        // GCS URL 파싱
        const url = new URL(screen.video_url);
        const pathParts = url.pathname.split('/').filter(part => part);
        
        const bucketName = pathParts[0];
        const objectName = pathParts.slice(1).join('/');
        const decodedObjectName = decodeURIComponent(objectName);
        
        console.log(`  Bucket: ${bucketName}`);
        console.log(`  Object: ${decodedObjectName}`);
        
        const bucket = objectStorageClient.bucket(bucketName);
        const file = bucket.file(decodedObjectName);
        
        // 파일 존재 확인
        const [exists] = await file.exists();
        if (!exists) {
          console.log(`  ❌ File does not exist`);
          errorCount++;
          continue;
        }
        
        // Public으로 설정
        await file.makePublic();
        console.log(`  ✅ Successfully made public`);
        successCount++;
        
      } catch (error) {
        console.error(`  ❌ Error:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Total: ${screens.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    
    await sql.end();
    
  } catch (error) {
    console.error('Fatal error:', error);
    await sql.end();
    process.exit(1);
  }
}

makeAllWaitingScreensPublic().then(() => {
  console.log('\nDone!');
  process.exit(0);
});

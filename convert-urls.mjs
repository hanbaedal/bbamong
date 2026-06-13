import pg from 'postgres';

const sql = pg(process.env.DATABASE_URL);

async function convertWaitingScreenUrls() {
  try {
    console.log('Fetching all waiting screens...');
    const screens = await sql`SELECT * FROM waiting_screens`;
    
    console.log(`Found ${screens.length} waiting screens`);
    
    for (const screen of screens) {
      const gcsUrl = screen.video_url;
      
      if (!gcsUrl.startsWith("https://storage.googleapis.com/")) {
        console.log(`Skipping ${screen.video_name} - already converted`);
        continue;
      }
      
      // GCS URL 파싱
      const url = new URL(gcsUrl);
      const pathParts = url.pathname.split('/').filter(part => part);
      
      // pathParts[0] = bucket, pathParts[1] = PRIVATE_OBJECT_DIR, rest = file path
      if (pathParts.length >= 2) {
        const filePath = pathParts.slice(2).join('/');
        const appUrl = `/objects/${filePath}`;
        
        console.log(`Converting ${screen.video_name}:`);
        console.log(`  From: ${gcsUrl}`);
        console.log(`  To: ${appUrl}`);
        
        await sql`
          UPDATE waiting_screens 
          SET video_url = ${appUrl}
          WHERE id = ${screen.id}
        `;
        
        console.log(`  ✅ Updated`);
      }
    }
    
    console.log('\nDone!');
    await sql.end();
    
  } catch (error) {
    console.error('Fatal error:', error);
    await sql.end();
    process.exit(1);
  }
}

convertWaitingScreenUrls().then(() => process.exit(0));

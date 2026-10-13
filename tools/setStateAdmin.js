/**
 * Makes an existing Firebase Auth user a state_admin for the Operator Portal.
 *
 * Only a state_admin can approve pantry claims and new-pantry submissions,
 * and no function can create the first one, so it is bootstrapped here with
 * the Admin SDK. Run it once per founder.
 *
 *   node tools/setStateAdmin.js founder@example.org            # grant
 *   node tools/setStateAdmin.js founder@example.org --dry-run  # show only
 *
 * The account must already exist (sign up in the portal first). The new
 * claims apply the next time that user signs in or refreshes their token.
 */
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

const STATE_ORG_ID = 'org_accessbelt_state';
const ALL_COUNTIES = [
    'Autauga', 'Baldwin', 'Barbour', 'Bibb', 'Blount', 'Bullock', 'Butler', 'Calhoun', 'Chambers', 'Cherokee',
    'Chilton', 'Choctaw', 'Clarke', 'Clay', 'Cleburne', 'Coffee', 'Colbert', 'Conecuh', 'Coosa', 'Covington',
    'Crenshaw', 'Cullman', 'Dale', 'Dallas', 'DeKalb', 'Elmore', 'Escambia', 'Etowah', 'Fayette', 'Franklin',
    'Geneva', 'Greene', 'Hale', 'Henry', 'Houston', 'Jackson', 'Jefferson', 'Lamar', 'Lauderdale', 'Lawrence',
    'Lee', 'Limestone', 'Lowndes', 'Macon', 'Madison', 'Marengo', 'Marion', 'Marshall', 'Mobile', 'Monroe',
    'Montgomery', 'Morgan', 'Perry', 'Pickens', 'Pike', 'Randolph', 'Russell', 'St. Clair', 'Shelby', 'Sumter',
    'Talladega', 'Tallapoosa', 'Tuscaloosa', 'Walker', 'Washington', 'Wilcox', 'Winston',
];

async function main() {
    const email = process.argv[2];
    const dryRun = process.argv.includes('--dry-run');
    if (!email || !email.includes('@')) {
        console.error('Usage: node tools/setStateAdmin.js <email> [--dry-run]');
        process.exit(1);
    }

    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const user = await admin.auth().getUserByEmail(email);
    const claims = {
        ...(user.customClaims ?? {}),
        role: 'state_admin',
        orgId: STATE_ORG_ID,
        counties: ALL_COUNTIES,
        pantryId: STATE_ORG_ID,
    };

    console.log(`${dryRun ? '[dry run] would set' : 'Setting'} state_admin on ${email} (${user.uid})`);
    if (dryRun) return;
    await admin.auth().setCustomUserClaims(user.uid, claims);
    console.log('Done. The user must sign out and back in for the new role to take effect.');
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});

/**
 * Data Migration Script: Migrate Existing Users to Organizations
 *
 * This script:
 * 1. Creates a personal organization for each existing user
 * 2. Transfers user credits to organization
 * 3. Updates all user's patents to belong to their organization
 * 4. Sets the organization as their current organization
 *
 * Run with: node migrations/migrate-to-organizations.js
 *
 * Make sure to set environment variables:
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

// Check for required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing required environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateToOrganizations() {
  console.log('🚀 Starting migration to organizations...\n');

  try {
    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    console.log(`Found ${profiles.length} users to migrate\n`);

    for (const profile of profiles) {
      console.log(`\n📧 Processing user: ${profile.email}`);

      try {
        // 1. Create personal organization
        const orgName = `${profile.email.split('@')[0]}'s Organization`;
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .insert({
            name: orgName,
            credits: profile.credits || 0, // Transfer user credits
          })
          .select()
          .single();

        if (orgError) {
          console.error(`  ❌ Failed to create org: ${orgError.message}`);
          continue;
        }

        console.log(`  ✅ Created organization: ${org.name} (${org.id})`);
        console.log(`  💰 Transferred ${org.credits} credits to organization`);

        // 2. Add user as admin of the organization
        const { error: memberError } = await supabase
          .from('organization_members')
          .insert({
            organization_id: org.id,
            user_id: profile.id,
            role: 'admin',
          });

        if (memberError) {
          console.error(`  ❌ Failed to add as member: ${memberError.message}`);
          continue;
        }

        console.log(`  👤 Added user as admin`);

        // 3. Set as current organization
        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({ current_organization_id: org.id })
          .eq('id', profile.id);

        if (updateProfileError) {
          console.error(`  ❌ Failed to update profile: ${updateProfileError.message}`);
        } else {
          console.log(`  🔄 Set as current organization`);
        }

        // 4. Update all user's patents to belong to organization
        const { data: patents, error: patentsError } = await supabase
          .from('patents')
          .select('id, title')
          .eq('user_id', profile.id);

        if (patentsError) {
          console.error(`  ❌ Failed to fetch patents: ${patentsError.message}`);
          continue;
        }

        if (patents && patents.length > 0) {
          const { error: updatePatentsError } = await supabase
            .from('patents')
            .update({ organization_id: org.id })
            .eq('user_id', profile.id);

          if (updatePatentsError) {
            console.error(`  ❌ Failed to update patents: ${updatePatentsError.message}`);
          } else {
            console.log(`  📄 Migrated ${patents.length} patents to organization`);
          }
        } else {
          console.log(`  📄 No patents to migrate`);
        }

        // 5. Update credit transactions to reference organization
        const { error: updateTransactionsError } = await supabase
          .from('credit_transactions')
          .update({ organization_id: org.id })
          .eq('user_id', profile.id);

        if (updateTransactionsError) {
          console.error(`  ❌ Failed to update transactions: ${updateTransactionsError.message}`);
        } else {
          console.log(`  💳 Updated credit transactions`);
        }

        console.log(`  ✨ Migration complete for ${profile.email}`);

      } catch (userError) {
        console.error(`  ❌ Error migrating ${profile.email}:`, userError);
      }
    }

    console.log('\n\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Verify organizations were created in Supabase dashboard');
    console.log('2. Test that users can see their migrated patents');
    console.log('3. Deploy updated code to production');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateToOrganizations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

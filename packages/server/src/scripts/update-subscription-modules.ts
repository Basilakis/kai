/**
 * Update Subscription Modules
 *
 * This script updates the available modules in the subscription system
 * to include the new material promotion module.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';

// Define the new module
const newModule = {
  name: 'materialPromotion',
  description: 'Material promotion in 3D models for factories',
  defaultEnabled: false
};

/**
 * Update the available modules in the subscription system
 */
async function updateSubscriptionModules() {
  logger.info('Updating subscription modules to include material promotion...');

  // Initialize Supabase client
  const supabase = supabaseClient.getClient();

  try {
    // Check if the modules table exists
    const { data: moduleData, error: moduleError } = await supabase
      .from('subscription_modules')
      .select('name')
      .eq('name', newModule.name)
      .maybeSingle();

    if (moduleError) {
      // If the table doesn't exist, we'll need to create it
      if (moduleError.code === 'PGRST116') {
        logger.info('Creating subscription_modules table...');

        // Create the table
        const { error: createError } = await supabase.rpc('exec_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS subscription_modules (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL UNIQUE,
              description TEXT,
              default_enabled BOOLEAN DEFAULT false,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Add trigger for updated_at
            CREATE OR REPLACE FUNCTION update_subscription_modules_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
              NEW.updated_at = NOW();
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS update_subscription_modules_updated_at ON subscription_modules;

            CREATE TRIGGER update_subscription_modules_updated_at
            BEFORE UPDATE ON subscription_modules
            FOR EACH ROW
            EXECUTE FUNCTION update_subscription_modules_updated_at();
          `
        });

        if (createError) {
          throw new Error(`Failed to create subscription_modules table: ${createError.message}`);
        }

        logger.info('subscription_modules table created successfully');
      } else {
        throw new Error(`Error checking for existing module: ${moduleError.message}`);
      }
    }

    // If the module already exists, update it
    if (moduleData) {
      logger.info(`Module ${newModule.name} already exists, updating...`);

      const { error: updateError } = await supabase
        .from('subscription_modules')
        .update({
          description: newModule.description,
          updated_at: new Date().toISOString()
        })
        .eq('name', newModule.name);

      if (updateError) {
        throw new Error(`Failed to update module: ${updateError.message}`);
      }

      logger.info(`Module ${newModule.name} updated successfully`);
    } else {
      // If the module doesn't exist, insert it
      logger.info(`Adding new module: ${newModule.name}`);

      const { error: insertError } = await supabase
        .from('subscription_modules')
        .insert({
          name: newModule.name,
          description: newModule.description,
          default_enabled: newModule.defaultEnabled
        });

      if (insertError) {
        throw new Error(`Failed to insert module: ${insertError.message}`);
      }

      logger.info(`Module ${newModule.name} added successfully`);
    }

    // Update factory subscription tiers to include the new module
    logger.info('Updating factory subscription tiers...');

    // Get all factory subscription tiers
    const { data: tiers, error: tiersError } = await supabase
      .from('subscription_tiers')
      .select('id, name, module_access')
      .contains('user_types', ['factory']);

    if (tiersError) {
      throw new Error(`Failed to get factory subscription tiers: ${tiersError.message}`);
    }

    if (!tiers || tiers.length === 0) {
      logger.warn('No factory subscription tiers found');
      return;
    }

    // Update each tier to include the new module
    for (const tier of tiers) {
      const moduleAccess = tier.module_access || [];

      // Check if the module is already included
      const moduleIndex = moduleAccess.findIndex((m: any) => m.name === newModule.name);

      if (moduleIndex >= 0) {
        logger.info(`Module ${newModule.name} already included in tier ${tier.name}`);
        continue;
      }

      // Add the new module
      moduleAccess.push({
        name: newModule.name,
        enabled: newModule.defaultEnabled
      });

      // Update the tier
      const { error: updateError } = await supabase
        .from('subscription_tiers')
        .update({
          module_access: moduleAccess,
          updated_at: new Date().toISOString()
        })
        .eq('id', tier.id);

      if (updateError) {
        logger.error(`Failed to update tier ${tier.name}: ${updateError.message}`);
        continue;
      }

      logger.info(`Updated tier ${tier.name} to include module ${newModule.name}`);
    }

    logger.info('Subscription modules update completed successfully');
    return true;
  } catch (error) {
    logger.error('Failed to update subscription modules:', error);
    throw error;
  }
}

// If this script is run directly, execute the update
if (require.main === module) {
  // Initialize Supabase client
  // In CI/CD environment, we need to check for environment-specific variables
  const environment = process.env.NODE_ENV || 'development';
  let supabaseUrl = process.env.SUPABASE_URL;
  let supabaseKey = process.env.SUPABASE_KEY;

  // Check for environment-specific variables (used in CI/CD)
  if (environment === 'production') {
    supabaseUrl = process.env.SUPABASE_URL_PRODUCTION || supabaseUrl;
    supabaseKey = process.env.SUPABASE_KEY_PRODUCTION || supabaseKey;
  } else if (environment === 'staging') {
    supabaseUrl = process.env.SUPABASE_URL_STAGING || supabaseUrl;
    supabaseKey = process.env.SUPABASE_KEY_STAGING || supabaseKey;
  }

  if (!supabaseUrl || !supabaseKey) {
    logger.error('Supabase credentials not found for environment: ' + environment);
    process.exit(1);
  }

  // Initialize Supabase client
  supabaseClient.init({
    url: supabaseUrl,
    key: supabaseKey
  });

  updateSubscriptionModules()
    .then(() => {
      logger.info('Subscription modules update script completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Subscription modules update script failed:', error);
      process.exit(1);
    });
}

export default updateSubscriptionModules;

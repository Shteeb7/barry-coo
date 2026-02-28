const { supabase } = require('../services/supabase');

/**
 * Write or update a key-value pair in Barry's long-term memory.
 */
async function updateMemory(key, value, category = null) {
  try {
    // Parse value as JSON if it's a string
    let jsonValue;
    try {
      jsonValue = JSON.parse(value);
    } catch {
      // If not valid JSON, treat as a JSON string
      jsonValue = value;
    }

    const { data, error } = await supabase
      .from('barry_memory')
      .upsert({
        key,
        value: jsonValue,
        category,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })
      .select()
      .single();

    if (error) {
      console.error('🎩 [Barry] Memory update error:', error);
      return {
        success: false,
        error: error.message,
        key
      };
    }

    console.log(`🎩 [Barry] Memory updated: ${key} = ${JSON.stringify(jsonValue)}`);

    return {
      success: true,
      key,
      value: jsonValue,
      category
    };
  } catch (err) {
    console.error('🎩 [Barry] Memory update exception:', err);
    return {
      success: false,
      error: err.message,
      key
    };
  }
}

module.exports = { updateMemory };

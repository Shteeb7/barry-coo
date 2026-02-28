const { supabase } = require('../services/supabase');

/**
 * Execute a read-only SQL query against Supabase.
 * CRITICAL: Only SELECT queries are allowed. All other operations are rejected.
 */
async function executeSql(query) {
  // Validate that query is read-only (SELECT only)
  const trimmedQuery = query.trim();
  const queryLower = trimmedQuery.toLowerCase();

  // Check if query starts with SELECT followed by space (allowing for whitespace and comments)
  if (!queryLower.startsWith('select ') && !queryLower.startsWith('select\t') && !queryLower.startsWith('select\n')) {
    return {
      success: false,
      error: 'Only SELECT queries are allowed. Barry cannot modify production data through raw SQL.',
      query: trimmedQuery
    };
  }

  // Additional safety: reject queries containing dangerous keywords
  const dangerousKeywords = [
    'drop', 'delete', 'update', 'insert', 'alter',
    'create', 'truncate', 'grant', 'revoke'
  ];

  for (const keyword of dangerousKeywords) {
    // Check for the keyword as a separate word (not part of a column name)
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(queryLower)) {
      return {
        success: false,
        error: `Query contains forbidden keyword: ${keyword.toUpperCase()}. Only SELECT queries are allowed.`,
        query: trimmedQuery
      };
    }
  }

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: trimmedQuery });

    if (error) {
      console.error('🎩 [Barry] SQL execution error:', error);
      return {
        success: false,
        error: error.message,
        query: trimmedQuery
      };
    }

    return {
      success: true,
      data,
      rowCount: data?.length || 0,
      query: trimmedQuery
    };
  } catch (err) {
    console.error('🎩 [Barry] SQL execution exception:', err);
    return {
      success: false,
      error: err.message,
      query: trimmedQuery
    };
  }
}

module.exports = { executeSql };

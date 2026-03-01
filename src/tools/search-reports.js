const { supabase } = require('../services/supabase');

/**
 * Search past Barry reports
 */
async function searchReports(query, reportType, limit = 10) {
  try {
    let queryBuilder = supabase
      .from('barry_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (reportType) {
      queryBuilder = queryBuilder.eq('report_type', reportType);
    }

    if (query) {
      // Search in summary and content fields
      queryBuilder = queryBuilder.or(`summary.ilike.%${query}%,content.ilike.%${query}%`);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('📊 [Barry] Report search error:', error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log(`📊 [Barry] Found ${data.length} report(s)`);

    return {
      success: true,
      reports: data,
      count: data.length
    };
  } catch (error) {
    console.error('📊 [Barry] Report search exception:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { searchReports };

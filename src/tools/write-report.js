const { supabase } = require('../services/supabase');

/**
 * Write an ad-hoc report during conversation
 */
async function writeReport(reportType, summary, content, metadata = null) {
  try {
    const { data, error } = await supabase
      .from('barry_reports')
      .insert({
        report_type: reportType,
        summary,
        content,
        metadata: metadata ? JSON.parse(metadata) : null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('📝 [Barry] Report write error:', error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log(`📝 [Barry] Report written: ${reportType} - ${summary}`);

    return {
      success: true,
      id: data.id,
      report_type: reportType,
      summary,
      created_at: data.created_at
    };
  } catch (error) {
    console.error('📝 [Barry] Report write exception:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { writeReport };

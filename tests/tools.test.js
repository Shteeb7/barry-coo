/**
 * CRITICAL: Tests for Barry's tools, especially SQL query validation
 * Using LIVE API calls with real credentials
 */

const { executeSql } = require('../src/tools/execute-sql');
const { updateMemory } = require('../src/tools/update-memory');
const { createEscalation } = require('../src/tools/create-escalation');

describe('execute_sql tool', () => {
  describe('CRITICAL: SQL injection prevention', () => {
    test('allows SELECT queries', async () => {
      const result = await executeSql('SELECT 1 as test');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('allows SELECT with lowercase', async () => {
      const result = await executeSql('select 1 as test');
      expect(result.success).toBe(true);
    });

    test('allows SELECT with whitespace', async () => {
      const result = await executeSql('  SELECT 1 as test  ');
      expect(result.success).toBe(true);
    });

    test('rejects DROP queries', async () => {
      const result = await executeSql('DROP TABLE users');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Only SELECT queries are allowed');
    });

    test('rejects DELETE queries', async () => {
      const result = await executeSql('DELETE FROM users');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Only SELECT queries are allowed');
    });

    test('rejects UPDATE queries', async () => {
      const result = await executeSql('UPDATE users SET name = "hacked"');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Only SELECT queries are allowed');
    });

    test('rejects INSERT queries', async () => {
      const result = await executeSql('INSERT INTO users VALUES (1)');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Only SELECT queries are allowed');
    });

    test('rejects ALTER queries', async () => {
      const result = await executeSql('ALTER TABLE users ADD COLUMN hacked TEXT');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Only SELECT queries are allowed');
    });

    test('rejects CREATE queries', async () => {
      const result = await executeSql('CREATE TABLE hacked (id INT)');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Only SELECT queries are allowed');
    });

    test('rejects TRUNCATE queries', async () => {
      const result = await executeSql('TRUNCATE TABLE users');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Only SELECT queries are allowed');
    });

    test('rejects non-SELECT queries even if they start with SELECT-like text', async () => {
      const result = await executeSql('SELECTINTO users FROM other_table');
      expect(result.success).toBe(false);
    });

    test('allows SELECT with column names containing dangerous keywords', async () => {
      const result = await executeSql('SELECT 1 as delete_date, 2 as update_count');
      expect(result.success).toBe(true);
    });
  });

  test('returns data and row count on success', async () => {
    const result = await executeSql('SELECT 1 as test_col');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });
});

describe('update_memory tool', () => {
  test('writes simple string values', async () => {
    const result = await updateMemory('test_key_' + Date.now(), 'test_value', 'test');
    expect(result.success).toBe(true);
  });

  test('handles JSON values', async () => {
    const result = await updateMemory('test_key_json_' + Date.now(), '{"complex": "object"}', 'test');
    expect(result.success).toBe(true);
  });
});

describe('create_escalation tool', () => {
  test('creates escalation with all fields', async () => {
    const result = await createEscalation(
      'Test Escalation ' + Date.now(),
      'Test description',
      'info',
      'test'
    );
    expect(result.success).toBe(true);
  });
});

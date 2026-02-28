/**
 * CRITICAL: Tests for Barry's tools, especially SQL query validation
 */

const { executeSql } = require('../src/tools/execute-sql');
const { updateMemory } = require('../src/tools/update-memory');
const { createEscalation } = require('../src/tools/create-escalation');

// Mock Supabase
jest.mock('../src/services/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(() => ({
      upsert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  }
}));

const { supabase } = require('../src/services/supabase');

describe('execute_sql tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CRITICAL: SQL injection prevention', () => {
    test('allows SELECT queries', async () => {
      supabase.rpc.mockResolvedValue({ data: [], error: null });

      const result = await executeSql('SELECT * FROM users');

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('exec_sql', { sql_query: 'SELECT * FROM users' });
    });

    test('allows SELECT with lowercase', async () => {
      supabase.rpc.mockResolvedValue({ data: [], error: null });

      const result = await executeSql('select * from users');

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalled();
    });

    test('allows SELECT with whitespace', async () => {
      supabase.rpc.mockResolvedValue({ data: [], error: null });

      const result = await executeSql('  SELECT * FROM users  ');

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalled();
    });

    test('rejects DROP queries', async () => {
      const result = await executeSql('DROP TABLE users');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only SELECT queries are allowed');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('rejects DELETE queries', async () => {
      const result = await executeSql('DELETE FROM users WHERE id = 1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only SELECT queries are allowed');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('rejects UPDATE queries', async () => {
      const result = await executeSql('UPDATE users SET name = "hacked"');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only SELECT queries are allowed');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('rejects INSERT queries', async () => {
      const result = await executeSql('INSERT INTO users (name) VALUES ("hacker")');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only SELECT queries are allowed');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('rejects ALTER queries', async () => {
      const result = await executeSql('ALTER TABLE users ADD COLUMN malicious TEXT');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only SELECT queries are allowed');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('rejects CREATE queries', async () => {
      const result = await executeSql('CREATE TABLE malicious (id INT)');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only SELECT queries are allowed');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('rejects TRUNCATE queries', async () => {
      const result = await executeSql('TRUNCATE TABLE users');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only SELECT queries are allowed');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('rejects non-SELECT queries even if they start with SELECT-like text', async () => {
      const result = await executeSql('SELECTION FROM users'); // Not actually SELECT

      expect(result.success).toBe(false);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('allows SELECT with column names containing dangerous keywords', async () => {
      supabase.rpc.mockResolvedValue({ data: [], error: null });

      // Column names like "delete_date" should be allowed
      const result = await executeSql('SELECT delete_date, update_count FROM users');

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalled();
    });
  });

  test('returns data and row count on success', async () => {
    const mockData = [{ id: 1, name: 'Test' }, { id: 2, name: 'Test2' }];
    supabase.rpc.mockResolvedValue({ data: mockData, error: null });

    const result = await executeSql('SELECT * FROM users');

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockData);
    expect(result.rowCount).toBe(2);
  });

  test('handles database errors gracefully', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Connection failed' } });

    const result = await executeSql('SELECT * FROM users');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection failed');
  });
});

describe('update_memory tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('writes simple string values', async () => {
    const mockUpsert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: { key: 'test_key', value: 'test_value' },
          error: null
        })
      }))
    }));

    supabase.from.mockReturnValue({ upsert: mockUpsert });

    const result = await updateMemory('test_key', '"test_value"', 'test_category');

    expect(result.success).toBe(true);
    expect(result.key).toBe('test_key');
  });

  test('handles JSON values', async () => {
    const mockUpsert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: { key: 'test_key', value: { complex: 'object' } },
          error: null
        })
      }))
    }));

    supabase.from.mockReturnValue({ upsert: mockUpsert });

    const result = await updateMemory('test_key', '{"complex": "object"}', 'test_category');

    expect(result.success).toBe(true);
    expect(result.value).toEqual({ complex: 'object' });
  });

  test('handles database errors gracefully', async () => {
    const mockUpsert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Write failed' }
        })
      }))
    }));

    supabase.from.mockReturnValue({ upsert: mockUpsert });

    const result = await updateMemory('test_key', '"value"');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Write failed');
  });
});

describe('create_escalation tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates escalation with all fields', async () => {
    const mockInsert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'test-uuid',
            title: 'Test Escalation',
            created_at: new Date().toISOString()
          },
          error: null
        })
      }))
    }));

    supabase.from.mockReturnValue({ insert: mockInsert });

    const result = await createEscalation(
      'Test Escalation',
      'Test description',
      'critical',
      'test_task'
    );

    expect(result.success).toBe(true);
    expect(result.title).toBe('Test Escalation');
    expect(result.severity).toBe('critical');
  });

  test('handles database errors gracefully', async () => {
    const mockInsert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Insert failed' }
        })
      }))
    }));

    supabase.from.mockReturnValue({ insert: mockInsert });

    const result = await createEscalation('Test', 'Description', 'info');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Insert failed');
  });
});

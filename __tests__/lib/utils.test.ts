import { cn, formatError } from '@/lib/utils';

describe('Utils', () => {
  describe('cn function', () => {
    it('should concatenate class names', () => {
      const result = cn('class1', 'class2');
      expect(result).toBe('class1 class2');
    });

    it('should handle conditional class names', () => {
      const result = cn('base', true && 'included', false && 'excluded');
      expect(result).toBe('base included');
    });

    it('should handle object notation', () => {
      const result = cn('base', { conditional: true, 'not-included': false });
      expect(result).toBe('base conditional');
    });
  });

  describe('formatError function', () => {
    it('should format error objects', () => {
      const error = new Error('Test error');
      const result = formatError(error);
      expect(result).toBe('Test error');
    });

    it('should handle string errors', () => {
      const result = formatError('Error message');
      expect(result).toBe('Error message');
    });

    it('should handle unknown error types', () => {
      const result = formatError({ custom: 'error' });
      expect(result).toBe('Unknown error');
    });
  });
}); 
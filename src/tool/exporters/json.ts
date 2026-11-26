import type { ExportFormat, Exporter, ExportOptions, ExportResult } from '@itsjust/core';
import { sanitizeFilename } from '@itsjust/core';
import { formatExportError, throwIfAborted } from './utils';

const jsonExporter: Exporter = {
  format: 'json' as ExportFormat,
  export: async (
    _element: HTMLElement,
    options: ExportOptions,
    stateSerializer?: () => string
  ): Promise<ExportResult> => {
    const signal = options.signal;
    throwIfAborted(signal);
    try {
      const serialized = stateSerializer ? stateSerializer() : '{}';
      const filename = sanitizeFilename(`${options.filename ?? 'jwt-builder-state'}.json`);
      return { success: true, data: serialized, filename, format: 'json' };
    } catch (error) {
      return {
        success: false,
        data: null,
        filename: sanitizeFilename(`${options.filename ?? 'jwt-builder-state'}.json`),
        format: 'json' as ExportFormat,
        error: formatExportError(error, 'json'),
      };
    }
  },
};

export default jsonExporter;

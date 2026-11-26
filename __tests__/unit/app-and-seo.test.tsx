import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import manifest from '@/app/manifest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import ErrorPage from '@/app/error';
import NotFound from '@/app/not-found';
import { JsonLd } from '@/app/json-ld';
import ToolPage from '@/app/page';
import { cn } from '@/lib/utils';
import { generateJsonLd, generateToolMetadata } from '@/lib/seo';
import toolConfig from '@/tool/tool.config';
import { getPublicSiteUrl, templateMetadata } from '@/tool/template-metadata';
import { jwtBuilderTool } from '@/tool/tool-definition';
import { Canvas } from '@/tool/components/Canvas';
import { Sidebar } from '@/tool/components/Sidebar';
import { Toolbar } from '@/tool/components/Toolbar';
import { DEFAULT_STATE as BASE_DEFAULT_STATE } from '@/tool/types';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/app/tool-client-wrapper', () => ({
  default: () => <div data-testid="tool-client-wrapper">tool-client-wrapper</div>,
}));

describe('app and seo', () => {
  const getOgImageUrl = (
    images: NonNullable<NonNullable<ReturnType<typeof generateToolMetadata>['openGraph']>['images']>
  ): string | undefined => {
    const list = Array.isArray(images) ? images : [images];
    const first = list[0];
    if (!first) return undefined;
    if (typeof first === 'string') return first;
    if (first instanceof URL) return first.toString();
    return String(first.url);
  };

  it('builds metadata and json-ld values', () => {
    const metadata = generateToolMetadata(toolConfig);
    const jsonLd = generateJsonLd(toolConfig);

    expect(metadata.creator).toBe(toolConfig.name);
    expect(metadata.metadataBase?.toString()).toBe('http://localhost:3000/');
    const ogUrl = metadata.openGraph?.images ? getOgImageUrl(metadata.openGraph.images) : undefined;
    expect(ogUrl).toContain('/og.svg');
    expect(jsonLd.url).toBe('http://localhost:3000');
    expect(jsonLd.featureList.length).toBeGreaterThan(0);
  });

  it('returns site manifest, robots and sitemap', () => {
    const man = manifest();
    const rob = robots();
    const sm = sitemap();

    expect(man.name).toBe(templateMetadata.appName);
    expect(rob.sitemap).toBe('http://localhost:3000/sitemap.xml');
    expect(sm[0]?.url).toBe('http://localhost:3000');
  });

  it('renders json-ld script safely', () => {
    render(<JsonLd config={{ ...toolConfig, name: '</script>' }} />);
    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script?.innerHTML).toContain('\\u003c/script>');
  });

  it('renders error page and invokes reset', () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error('boom')} reset={reset} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders not-found page', () => {
    render(<NotFound />);
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
  });

  it('renders top-level tool page', () => {
    render(<ToolPage />);
    expect(screen.getByTestId('tool-client-wrapper')).toBeInTheDocument();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeInTheDocument();
  });

  it('covers tool definition and helper exports', async () => {
    expect(cn('a', undefined, 'b', false, null, 'c')).toBe('a b c');
    expect(getPublicSiteUrl()).toBe('http://localhost:3000');
    expect(jwtBuilderTool.name).toBe(toolConfig.name);
    const repaired = jwtBuilderTool.deserialize({ nope: true });
    expect(repaired.success).toBe(true);
    if (repaired.success) {
      expect(repaired.data.alg).toBe(BASE_DEFAULT_STATE.alg);
      expect(repaired.data.claims).toEqual([]);
    }
    expect(jwtBuilderTool.serialize(BASE_DEFAULT_STATE)).toContain('"alg":"HS256"');
    const exporters = jwtBuilderTool.exporters ?? [];
    expect(exporters).toHaveLength(1);
    const first = exporters[0];
    expect(first).toBeDefined();
    if (!first) throw new Error('missing exporter');
    const mod = await first.loader();
    const resolved = 'default' in mod ? mod.default : mod.exporter;
    expect(resolved.format).toBe('json');
    const result = await resolved.export(
      document.createElement('div'),
      { format: 'json', filename: 'test' },
      () => '{"alg":"HS256"}'
    );
    expect(result.success).toBe(true);
    expect(result.data).toBe('{"alg":"HS256"}');
  });

  it('renders tool components', () => {
    render(
      <>
        <Toolbar
          state={{ ...BASE_DEFAULT_STATE }}
          onChange={() => {}}
          onClear={() => {}}
          onCopy={() => {}}
        />
        <Sidebar state={{ ...BASE_DEFAULT_STATE }} onChange={() => {}} />
        <Canvas state={{ ...BASE_DEFAULT_STATE }} onChange={() => {}} />
      </>
    );

    expect(screen.getByTestId('select-alg')).toHaveValue('HS256');
    expect(screen.getByTestId('token-card')).toBeInTheDocument();
    expect(screen.getByTestId('token-placeholder')).toBeInTheDocument();
    expect(screen.getByTestId('claims-list')).toBeInTheDocument();
  });

  it('renders token segments and decoded payload for a signed token', () => {
    const token = [
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({ sub: 'abc', exp: 1300819380 })).toString('base64url'),
      Buffer.from(new Uint8Array(32)).toString('base64url'),
    ].join('.');
    render(<Canvas state={{ ...BASE_DEFAULT_STATE }} onChange={() => {}} token={token} />);
    expect(screen.getByTestId('segment-header')).toBeInTheDocument();
    expect(screen.getByTestId('segment-payload')).toBeInTheDocument();
    expect(screen.getByTestId('segment-signature')).toBeInTheDocument();
    expect(screen.getByTestId('decoded-payload').textContent).toContain('"sub"');
    expect(screen.getByTestId('copy-token')).toBeInTheDocument();
  });

  it('shows an error and drops the preview when token Error is set', () => {
    render(
      <Canvas
        state={{ ...BASE_DEFAULT_STATE }}
        onChange={() => {}}
        token={null}
        error="Signing secret is required"
      />
    );
    expect(screen.getByTestId('token-error')).toHaveTextContent('Signing secret is required');
    expect(screen.queryByTestId('token-preview')).not.toBeInTheDocument();
  });

  it('disables the sign button when validation fails', () => {
    render(
      <Canvas
        state={{ ...BASE_DEFAULT_STATE, secret: '' }}
        onChange={() => {}}
        onSaveHistory={() => {}}
      />
    );
    expect(screen.getByTestId('btn-sign-token')).toBeDisabled();
    expect(screen.getByTestId('secret-error')).toBeInTheDocument();
  });

  it('reveals and hides the secret field and removes claims', () => {
    const onChange = vi.fn();
    render(
      <Canvas
        state={{ ...BASE_DEFAULT_STATE, claims: [{ ...BASE_DEFAULT_STATE.claims[0]!, id: 'c1' }] }}
        onChange={onChange}
      />
    );
    const secretInput = screen.getByTestId('input-secret');
    expect(secretInput).toHaveAttribute('type', 'password');
    const toggle = screen.getByTestId('btn-toggle-secret');
    toggle.click();
    expect(onChange).toHaveBeenCalled();
    screen.getByTestId('claim-remove').click();
    const lastCall = onChange.mock.calls.at(-1)?.[0] as { claims: unknown[] };
    expect(lastCall.claims).toEqual([]);
  });

  it('renders sidebar registered-claim buttons and relative helpers', () => {
    const onChange = vi.fn();
    render(<Sidebar state={{ ...BASE_DEFAULT_STATE }} onChange={onChange} />);
    expect(screen.getAllByTestId(/^add-claim-/)).toHaveLength(7);
    screen.getByTestId('add-claim-exp').click();
    const added = onChange.mock.calls[0]?.[0] as { claims: Array<{ name: string; type: string }> };
    expect(added.claims.at(-1)?.name).toBe('exp');
    expect(added.claims.at(-1)?.type).toBe('number');
  });

  it('sidebar relative helpers rewrite epoch claims', () => {
    const onChange = vi.fn();
    const state = {
      ...BASE_DEFAULT_STATE,
      claims: [{ id: 'e1', name: 'exp', type: 'number' as const, value: '1' }],
    };
    render(<Sidebar state={state} onChange={onChange} />);
    screen.getByTestId('relative-exp-60').click();
    const next = onChange.mock.calls[0]?.[0] as { claims: Array<{ value: string }> };
    expect(Number(next.claims[0]?.value)).toBe(Math.floor(Date.now() / 1000) + 3600);
    expect(screen.getByTestId('sidebar-history-count').textContent).toContain('0 tokens');
  });

  it('toolbar algorithm select changes state', () => {
    const onChange = vi.fn();
    render(<Toolbar state={{ ...BASE_DEFAULT_STATE }} onChange={onChange} onClear={() => {}} />);
    expect(screen.getByTestId('toolbar-alg-label')).toHaveTextContent('HS256');
  });
});

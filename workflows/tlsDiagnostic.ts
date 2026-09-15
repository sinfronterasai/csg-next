import tls from 'node:tls';

export async function diagnoseN8nTls() {
  const raw = process.env.N8N_REPORT_WEBHOOK_URL;
  if (!raw) return { ok: false, error: 'N8N_REPORT_WEBHOOK_URL missing' };
  const url = new URL(raw);
  const port = Number(url.port || 443);
  const inspection = await new Promise<Record<string, unknown>>((resolve) => {
    const socket = tls.connect({ host: url.hostname, port, servername: url.hostname, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate();
      resolve({
        ok: true,
        hostname: url.hostname,
        port,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError || null,
        subject: cert.subject?.CN || null,
        issuer: cert.issuer?.CN || null,
        validFrom: cert.valid_from || null,
        validTo: cert.valid_to || null,
        fingerprint256: cert.fingerprint256 || null,
      });
      socket.end();
    });
    socket.setTimeout(15_000, () => {
      socket.destroy();
      resolve({ ok: false, hostname: url.hostname, port, error: 'TLS connection timeout' });
    });
    socket.on('error', (error) => resolve({ ok: false, hostname: url.hostname, port, error: error.message }));
  });
  if (!inspection.ok) return inspection;
  try {
    const sizes = [50_000, 100_000, 200_000, 500_000, 1_000_000];
    const sizeResults = [];
    for (const size of sizes) {
      try {
        const response = await fetch(raw, {
          method: 'POST',
          redirect: 'manual',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${process.env.REPORT_PIPELINE_TOKEN || ''}`,
          },
          body: JSON.stringify({ reportId: 'diagnostic-size-probe', reportType: 'yearlytransit', tier: 'paid', pad: 'x'.repeat(size) }),
        });
        sizeResults.push({ requestedBytes: size, httpStatus: response.status });
      } catch (error) {
        sizeResults.push({ requestedBytes: size, httpStatus: null, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { ...inspection, sizeResults };
  } catch (error) {
    return { ...inspection, httpStatus: null, httpError: error instanceof Error ? error.message : String(error) };
  }
}

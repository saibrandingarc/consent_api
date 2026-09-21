import PDFDocument from 'pdfkit';
import type { ConsentProofView } from './consent-records.service';

export function generateConsentProofPdf(proof: ConsentProofView): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Proof of Consent', { underline: true });
    doc.moveDown(0.75);
    doc.fontSize(10);

    const lines: Array<[string, string]> = [
      ['Consent ID', proof.consentId],
      ['Domain', proof.domainHostname],
      ['Visitor ID', proof.visitorId],
      ['Authenticated user', proof.authenticatedUserId ?? '—'],
      ['Status', proof.consentStatus],
      ['Event', proof.eventType],
      ['Collection source', proof.collectionSource],
      ['Recorded at', new Date(proof.createdAt).toLocaleString()],
      ['Expires', proof.expiresAt ? new Date(proof.expiresAt).toLocaleString() : '—'],
      ['Region / language', `${proof.region ?? '—'} / ${proof.language ?? '—'}`],
      ['Regulation', proof.regulation ?? '—'],
      ['Policy version', proof.policyVersionId ?? '—'],
      ['Config / banner version', `${proof.configVersion} / ${proof.bannerVersion ?? '—'}`],
      ['Verification hash', proof.proofHash],
      ['Policy snapshot hash', proof.policySnapshotHash ?? '—'],
      ['IP stored (hashed)', proof.ipAddressStored ? 'Yes' : 'No'],
    ];

    for (const [label, value] of lines) {
      doc.text(`${label}: ${value}`);
    }

    doc.moveDown();
    doc.fontSize(12).text('Categories', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    for (const [slug, enabled] of Object.entries(proof.categories)) {
      doc.text(`${slug}: ${enabled ? 'Enabled' : 'Disabled'}`);
    }

    if (proof.vendors && Object.keys(proof.vendors).length > 0) {
      doc.moveDown();
      doc.fontSize(12).text('Vendors', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      for (const [vendor, enabled] of Object.entries(proof.vendors)) {
        doc.text(`${vendor}: ${enabled ? 'Allowed' : 'Denied'}`);
      }
    }

    if (proof.policySnapshot?.banner) {
      const banner = proof.policySnapshot.banner as Record<string, string>;
      doc.moveDown();
      doc.fontSize(12).text('Banner shown to visitor', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      if (banner.title) doc.text(`Title: ${banner.title}`);
      if (banner.description) doc.text(`Description: ${banner.description}`);
      if (banner.acceptButton) doc.text(`Accept: ${banner.acceptButton}`);
      if (banner.rejectButton) doc.text(`Reject: ${banner.rejectButton}`);
      if (banner.legalNotice) doc.text(`Legal notice: ${banner.legalNotice}`);
    }

    if (proof.history.length > 1) {
      doc.moveDown();
      doc.fontSize(12).text('Consent history', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9);
      for (const entry of proof.history) {
        doc.text(
          `${new Date(entry.createdAt).toLocaleString()} — ${entry.consentStatus} / ${entry.eventType} (${entry.collectionSource})`,
        );
      }
    }

    doc.end();
  });
}

export function consentProofToCsv(proof: ConsentProofView): string {
  const header =
    'consent_id,domain,visitor_id,status,event,collection_source,region,language,regulation,config_version,proof_hash,created_at\n';
  const row = [
    proof.consentId,
    proof.domainHostname,
    proof.visitorId,
    proof.consentStatus,
    proof.eventType,
    proof.collectionSource,
    proof.region ?? '',
    proof.language ?? '',
    proof.regulation ?? '',
    proof.configVersion,
    proof.proofHash,
    proof.createdAt,
  ]
    .map((value) => `"${String(value).replace(/"/g, '""')}"`)
    .join(',');
  return header + row;
}

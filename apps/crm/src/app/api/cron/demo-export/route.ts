import { NextRequest, NextResponse } from 'next/server';
import { systemQuery } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * T89 / NFR-R7: Weekly static demo export cron.
 * Generates a self-contained HTML file wrapping the public projection data.
 * Acts as the absolute last-resort fallback for presentation mode, operable directly from a USB stick.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch public-safe projection data only
    const { projects, units } = await systemQuery(async (tx) => {
      const projects = await tx.execute(sql`SELECT project_id, name, total_units, available_units FROM projection.projects_pub`);
      const units = await tx.execute(sql`SELECT unit_id, project_id, unit_number, presentation_status, price_paise, price_on_request FROM projection.units_pub`);
      return { projects, units };
    });

    const exportData = {
      timestamp: new Date().toISOString(),
      projects: projects as any[],
      units: units as any[]
    };

    // 2. Generate a robust, dependency-free static HTML page
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Offline Demo Fallback</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background: #f9fafb; color: #111; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { margin-bottom: 5px; }
        .timestamp { color: #6b7280; font-size: 14px; margin-bottom: 30px; }
        .project { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .project h2 { margin: 0 0 10px 0; }
        .stats { font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 20px; }
        .unit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
        .unit { padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; font-weight: 500; display: flex; flex-direction: column; gap: 4px; }

        /* Status Colors mapping exactly to FR-PM4 */
        .status-available { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
        .status-selling_fast { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
        .status-booked { background: #dbeafe; color: #1e40af; border-color: #bfdbfe; }
        .status-sold { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
        .status-on_hold { background: #fef9c3; color: #854d0e; border-color: #fef08a; }
        .status-not_for_sale { background: #f3f4f6; color: #4b5563; border-color: #e5e7eb; }

        .price { font-family: monospace; font-size: 12px; opacity: 0.8; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Offline Demo Fallback</h1>
        <div class="timestamp">Generated on: <span id="timestamp"></span></div>
        <div id="content">Loading static payload...</div>
    </div>

    <script>
        const DATA = ${JSON.stringify(exportData)};
        document.getElementById('timestamp').innerText = new Date(DATA.timestamp).toLocaleString();

        const formatPaise = (paise) => {
            if (!paise) return 'N/A';
            const rupees = Number(paise) / 100;
            if (rupees >= 10000000) return '₹' + (rupees / 10000000).toFixed(2) + ' Cr';
            if (rupees >= 100000) return '₹' + (rupees / 100000).toFixed(2) + ' L';
            return '₹' + rupees.toLocaleString();
        };

        const content = document.getElementById('content');
        content.innerHTML = DATA.projects.map(p => {
            const pUnits = DATA.units.filter(u => u.project_id === p.project_id)
                .sort((a,b) => a.unit_number.localeCompare(b.unit_number, undefined, {numeric: true}));

            const unitsHtml = pUnits.map(u => {
                const priceStr = u.price_on_request ? 'POR' : formatPaise(u.price_paise);
                return '<div class="unit status-' + u.presentation_status + '">' +
                    '<span>Unit ' + u.unit_number + '</span>' +
                    '<span style="text-transform: capitalize; font-size: 11px; opacity: 0.9;">' + u.presentation_status.replace('_', ' ') + '</span>' +
                    '<span class="price">' + priceStr + '</span>' +
                '</div>';
            }).join('');

            return '<div class="project">' +
                '<h2>' + p.name + '</h2>' +
                '<div class="stats">' + p.available_units + ' of ' + p.total_units + ' units available</div>' +
                '<div class="unit-grid">' + unitsHtml + '</div>' +
            '</div>';
        }).join('');
    </script>
</body>
</html>`;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 3. Upload to Supabase Storage explicitly using the service key
    if (supabaseUrl && supabaseKey) {
      const uploadUrl = `${supabaseUrl}/storage/v1/object/media/exports/fallback-demo.html`;

      await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'text/html',
          'x-upsert': 'true'
        },
        body: html
      });
    }

    return NextResponse.json({ ok: true, message: 'Static demo generated successfully' });
  } catch (err: any) {
    console.error('Demo export cron failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

# Emergency Runbook
**"The site is down, the client is in the room, and Dev is unreachable."**

## Scenario 1: Presentation Mode is Down during a Client Meeting
**Symptoms:** The TV shows a blank screen, a 500 error, or assets fail to load.
**Immediate Action (The Fallback):**
1. Do not troubleshoot the network or refresh repeatedly.
2. Locate the office USB drive, or navigate directly to the weekly export URL:  
   `https://[project-ref].supabase.co/storage/v1/object/public/media/exports/fallback-demo.html`
3. Open the HTML file. This is a fully offline, self-contained file containing the latest inventory status and pricing (generated weekly per NFR-R7).
4. Conduct the meeting using this static list.

## Scenario 2: CRM is Unreachable
**Symptoms:** `crm.example.com` shows a 500 error or fails to load entirely.
**Checks:**
1. Check Vercel Status: `https://www.vercel-status.com/`
2. Check Supabase Status (Mumbai Region): `https://status.supabase.com/`
**Action:** 
If external providers are experiencing an outage, wait. **No data is lost.** Log interactions, follow-ups, and tokens manually on paper or WhatsApp. Input them when service restores.

## Scenario 3: Accidental Data Deletion
**Symptoms:** An agent/owner corrupted lead data or misconfigured a price version disastrously.
**Action:** 
1. Log into Supabase immediately.
2. Go to **Database > Backups > Point in Time Recovery**.
3. Restore to 1 minute prior to the disaster. 

import psycopg2
from datetime import datetime
import pytz

conn = psycopg2.connect('postgresql://neondb_owner:npg_lgR4aKWEdr0Z@ep-dry-union-afoh4cqc.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require')
cur = conn.cursor()

# Query per vedere i post FAILED del 9 dicembre
cur.execute("""
    SELECT id, "scheduledFor", status, timezone, "videoFilenames"
    FROM scheduled_posts
    WHERE DATE("scheduledFor" AT TIME ZONE 'Europe/Rome') = '2025-12-09'
    ORDER BY "scheduledFor" DESC
    LIMIT 10
""")

print('POST del 9 dicembre 2025 (tutti gli stati):')
print('='*80)

rome_tz = pytz.timezone('Europe/Rome')

for row in cur.fetchall():
    id, sched_for, status, tz, videos = row
    
    # Converti in timezone Europe/Rome
    if sched_for.tzinfo is None:
        # Se non ha timezone, assumiamo UTC
        sched_for_utc = pytz.UTC.localize(sched_for)
    else:
        sched_for_utc = sched_for
    
    sched_for_rome = sched_for_utc.astimezone(rome_tz)
    
    print(f'ID: {id}')
    print(f'  scheduledFor (DB raw): {row[1]}')
    print(f'  scheduledFor (UTC):    {sched_for_utc.strftime("%Y-%m-%d %H:%M:%S %Z")}')
    print(f'  scheduledFor (IT):     {sched_for_rome.strftime("%Y-%m-%d %H:%M:%S %Z")}')
    print(f'  Status: {status}')
    print(f'  Timezone field: {tz}')
    if videos:
        print(f'  Videos: {videos[:60]}...')
    print('-'*80)

cur.close()
conn.close()

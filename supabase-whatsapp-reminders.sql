alter table appointments
add column if not exists whatsapp_reminder_sent_at timestamptz,
add column if not exists whatsapp_reminder_error text;

create index if not exists appointments_whatsapp_reminder_idx
on appointments (appointment_date, status, whatsapp_reminder_sent_at);

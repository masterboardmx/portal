const SUPABASE_URL='https://qsjscxnlbxwvhgzjjvuh.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzanNjeG5sYnh3dmhnempqdnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NjY4NzksImV4cCI6MjA4OTQ0Mjg3OX0.okSdl7TOF1Tcntfcbv44QGJi4k0D4u85IHCNmdsnUg8';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
// Contraseñas eliminadas del cliente — autenticación vía Supabase Auth
const USER_EMAILS={'Alan':'alan@masterboard.mx','Azul':'azul@masterboard.mx','Alonso':'alonso@masterboard.mx','Chitara':'chitara@masterboard.mx'};
const MASTER='Alan';
const CONTABILIDAD_USERS=['Alan','Alonso'];
const AGENDA_USERS=['Alan','Chitara'];
let currentUser=null,allOrdenes=[],allClientes=[],allAuditoria=[],editingOrdenId=null,editingClienteId=null;

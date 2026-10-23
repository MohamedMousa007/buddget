update admin_roles set permissions = array_append(permissions, 'dsr.manage')
  where key in ('admin','compliance','support_lead') and not ('dsr.manage' = any(permissions));

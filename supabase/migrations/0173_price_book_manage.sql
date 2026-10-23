update admin_roles set permissions = array_append(permissions, 'ai.cost.manage')
  where key in ('admin','finance') and not ('ai.cost.manage' = any(permissions));

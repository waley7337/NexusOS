"""cross tenant composite fks and soft delete safe unique indexes

Revision ID: 217e90d00cc0
Revises: 3a2aec52f6d2
Create Date: 2026-07-15 03:43:52.459854

Two independent hardening changes, bundled together because they both
touch the same set of tables' `__table_args__`:

1. Cross-tenant relationship protection (composite foreign keys). Every
   child -> parent reference between tenant-owned tables (e.g.
   `invoices.customer_id -> customers`) is widened to a composite FK on
   `(fk_column, company_id) -> (id, company_id)`. This makes a
   cross-tenant reference a *database-level* impossibility, not just an
   application-level convention — defense in depth for the case where a
   future service accidentally resolves a related row without checking
   its tenant. The plain single-column FKs are left in place unchanged.

   Composite FKs need a matching unique constraint on the referenced
   `(id, company_id)` pair, so this migration also adds one such
   "anchor" constraint per referenced parent table. Those MUST be created
   before any FK that references them (hence the ordering below).

2. Soft-delete/uniqueness compatibility. Several tenant-scoped uniqueness
   rules (email, slug, invoice/employee number, SKU, warehouse/supplier
   name, one-to-one deal<->lead, one-to-one employee<->user) were plain
   UniqueConstraints that would permanently "squat" a value after a soft
   delete, blocking legitimate reuse (re-invite, re-issue, rehire, SKU
   reuse, …). Each is replaced with a partial unique index scoped to
   `WHERE deleted_at IS NULL`, so the rule only applies to live rows.
"""
from alembic import op
import sqlalchemy as sa


revision = '217e90d00cc0'
down_revision = '3a2aec52f6d2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Step 1: anchor unique constraints on (id, company_id) — must
    # exist before any composite FK below can reference them. ---
    op.create_unique_constraint('uq_ai_conversations_id_company', 'ai_conversations', ['id', 'company_id'])
    op.create_unique_constraint('uq_customers_id_company', 'customers', ['id', 'company_id'])
    op.create_unique_constraint('uq_employees_id_company', 'employees', ['id', 'company_id'])
    op.create_unique_constraint('uq_invoices_id_company', 'invoices', ['id', 'company_id'])
    op.create_unique_constraint('uq_leads_id_company', 'leads', ['id', 'company_id'])
    op.create_unique_constraint('uq_products_id_company', 'products', ['id', 'company_id'])
    op.create_unique_constraint('uq_projects_id_company', 'projects', ['id', 'company_id'])
    op.create_unique_constraint('uq_suppliers_id_company', 'suppliers', ['id', 'company_id'])
    op.create_unique_constraint('uq_tasks_id_company', 'tasks', ['id', 'company_id'])
    op.create_unique_constraint('uq_users_id_company', 'users', ['id', 'company_id'])
    op.create_unique_constraint('uq_warehouses_id_company', 'warehouses', ['id', 'company_id'])
    op.create_unique_constraint('uq_workflows_id_company', 'workflows', ['id', 'company_id'])

    # --- Step 2: composite cross-tenant FKs (now safe to add). ---
    op.create_foreign_key('fk_ai_messages_conversation_id_tenant_scoped', 'ai_messages', 'ai_conversations', ['conversation_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_attendance_employee_id_tenant_scoped', 'attendance', 'employees', ['employee_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_contacts_customer_id_tenant_scoped', 'contacts', 'customers', ['customer_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_customer_notes_customer_id_tenant_scoped', 'customer_notes', 'customers', ['customer_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_deals_lead_id_tenant_scoped', 'deals', 'leads', ['lead_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_employees_user_id_tenant_scoped', 'employees', 'users', ['user_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_employees_manager_id_tenant_scoped', 'employees', 'employees', ['manager_id', 'company_id'], ['id', 'company_id'], ondelete='SET NULL')
    op.create_foreign_key('fk_inventory_product_id_tenant_scoped', 'inventory', 'products', ['product_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_inventory_warehouse_id_tenant_scoped', 'inventory', 'warehouses', ['warehouse_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_invoice_items_invoice_id_tenant_scoped', 'invoice_items', 'invoices', ['invoice_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_invoices_customer_id_tenant_scoped', 'invoices', 'customers', ['customer_id', 'company_id'], ['id', 'company_id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_leads_customer_id_tenant_scoped', 'leads', 'customers', ['customer_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_leave_requests_employee_id_tenant_scoped', 'leave_requests', 'employees', ['employee_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_meetings_customer_id_tenant_scoped', 'meetings', 'customers', ['customer_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_payments_invoice_id_tenant_scoped', 'payments', 'invoices', ['invoice_id', 'company_id'], ['id', 'company_id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_purchase_orders_supplier_id_tenant_scoped', 'purchase_orders', 'suppliers', ['supplier_id', 'company_id'], ['id', 'company_id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_task_attachments_task_id_tenant_scoped', 'task_attachments', 'tasks', ['task_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_task_comments_task_id_tenant_scoped', 'task_comments', 'tasks', ['task_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_tasks_project_id_tenant_scoped', 'tasks', 'projects', ['project_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')
    op.create_foreign_key('fk_workflow_steps_workflow_id_tenant_scoped', 'workflow_steps', 'workflows', ['workflow_id', 'company_id'], ['id', 'company_id'], ondelete='CASCADE')

    # --- Step 3: soft-delete-safe partial unique indexes. ---
    op.drop_constraint('uq_attendance_employee_date', 'attendance', type_='unique')
    op.create_index('ix_attendance_employee_date_active_uq', 'attendance', ['employee_id', 'date'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_constraint('uq_companies_slug', 'companies', type_='unique')
    op.create_index('ix_companies_slug_active_uq', 'companies', ['slug'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_constraint('uq_deals_lead_id', 'deals', type_='unique')
    op.create_index('ix_deals_lead_id_active_uq', 'deals', ['lead_id'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_constraint('uq_employees_company_number', 'employees', type_='unique')
    op.drop_constraint('uq_employees_user_id', 'employees', type_='unique')
    op.create_index('ix_employees_company_number_active_uq', 'employees', ['company_id', 'employee_number'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_index('ix_employees_user_id_active_uq', 'employees', ['user_id'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_constraint('uq_invoices_company_number', 'invoices', type_='unique')
    op.create_index('ix_invoices_company_number_active_uq', 'invoices', ['company_id', 'invoice_number'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_constraint('uq_products_company_sku', 'products', type_='unique')
    op.create_index('ix_products_company_sku_active_uq', 'products', ['company_id', 'sku'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_constraint('uq_suppliers_company_name', 'suppliers', type_='unique')
    op.create_index('ix_suppliers_company_name_active_uq', 'suppliers', ['company_id', 'name'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_constraint('uq_users_company_email', 'users', type_='unique')
    op.create_index('ix_users_company_email_active_uq', 'users', ['company_id', 'email'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_constraint('uq_warehouses_company_name', 'warehouses', type_='unique')
    op.create_index('ix_warehouses_company_name_active_uq', 'warehouses', ['company_id', 'name'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))


def downgrade() -> None:
    # --- Reverse of step 3 ---
    op.drop_index('ix_warehouses_company_name_active_uq', table_name='warehouses', postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_unique_constraint('uq_warehouses_company_name', 'warehouses', ['company_id', 'name'])
    op.drop_index('ix_users_company_email_active_uq', table_name='users', postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_unique_constraint('uq_users_company_email', 'users', ['company_id', 'email'])
    op.drop_index('ix_suppliers_company_name_active_uq', table_name='suppliers', postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_unique_constraint('uq_suppliers_company_name', 'suppliers', ['company_id', 'name'])
    op.drop_index('ix_products_company_sku_active_uq', table_name='products', postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_unique_constraint('uq_products_company_sku', 'products', ['company_id', 'sku'])
    op.drop_index('ix_invoices_company_number_active_uq', table_name='invoices', postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_unique_constraint('uq_invoices_company_number', 'invoices', ['company_id', 'invoice_number'])
    op.drop_index('ix_employees_user_id_active_uq', table_name='employees', postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_index('ix_employees_company_number_active_uq', table_name='employees', postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_unique_constraint('uq_employees_user_id', 'employees', ['user_id'])
    op.create_unique_constraint('uq_employees_company_number', 'employees', ['company_id', 'employee_number'])
    op.drop_index('ix_deals_lead_id_active_uq', table_name='deals', postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_unique_constraint('uq_deals_lead_id', 'deals', ['lead_id'])
    op.drop_index('ix_companies_slug_active_uq', table_name='companies', postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_unique_constraint('uq_companies_slug', 'companies', ['slug'])
    op.drop_index('ix_attendance_employee_date_active_uq', table_name='attendance', postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_unique_constraint('uq_attendance_employee_date', 'attendance', ['employee_id', 'date'])

    # --- Reverse of step 2 ---
    op.drop_constraint('fk_workflow_steps_workflow_id_tenant_scoped', 'workflow_steps', type_='foreignkey')
    op.drop_constraint('fk_tasks_project_id_tenant_scoped', 'tasks', type_='foreignkey')
    op.drop_constraint('fk_task_comments_task_id_tenant_scoped', 'task_comments', type_='foreignkey')
    op.drop_constraint('fk_task_attachments_task_id_tenant_scoped', 'task_attachments', type_='foreignkey')
    op.drop_constraint('fk_purchase_orders_supplier_id_tenant_scoped', 'purchase_orders', type_='foreignkey')
    op.drop_constraint('fk_payments_invoice_id_tenant_scoped', 'payments', type_='foreignkey')
    op.drop_constraint('fk_meetings_customer_id_tenant_scoped', 'meetings', type_='foreignkey')
    op.drop_constraint('fk_leave_requests_employee_id_tenant_scoped', 'leave_requests', type_='foreignkey')
    op.drop_constraint('fk_leads_customer_id_tenant_scoped', 'leads', type_='foreignkey')
    op.drop_constraint('fk_invoices_customer_id_tenant_scoped', 'invoices', type_='foreignkey')
    op.drop_constraint('fk_invoice_items_invoice_id_tenant_scoped', 'invoice_items', type_='foreignkey')
    op.drop_constraint('fk_inventory_warehouse_id_tenant_scoped', 'inventory', type_='foreignkey')
    op.drop_constraint('fk_inventory_product_id_tenant_scoped', 'inventory', type_='foreignkey')
    op.drop_constraint('fk_employees_manager_id_tenant_scoped', 'employees', type_='foreignkey')
    op.drop_constraint('fk_employees_user_id_tenant_scoped', 'employees', type_='foreignkey')
    op.drop_constraint('fk_deals_lead_id_tenant_scoped', 'deals', type_='foreignkey')
    op.drop_constraint('fk_customer_notes_customer_id_tenant_scoped', 'customer_notes', type_='foreignkey')
    op.drop_constraint('fk_contacts_customer_id_tenant_scoped', 'contacts', type_='foreignkey')
    op.drop_constraint('fk_attendance_employee_id_tenant_scoped', 'attendance', type_='foreignkey')
    op.drop_constraint('fk_ai_messages_conversation_id_tenant_scoped', 'ai_messages', type_='foreignkey')

    # --- Reverse of step 1 ---
    op.drop_constraint('uq_workflows_id_company', 'workflows', type_='unique')
    op.drop_constraint('uq_warehouses_id_company', 'warehouses', type_='unique')
    op.drop_constraint('uq_users_id_company', 'users', type_='unique')
    op.drop_constraint('uq_tasks_id_company', 'tasks', type_='unique')
    op.drop_constraint('uq_suppliers_id_company', 'suppliers', type_='unique')
    op.drop_constraint('uq_projects_id_company', 'projects', type_='unique')
    op.drop_constraint('uq_products_id_company', 'products', type_='unique')
    op.drop_constraint('uq_leads_id_company', 'leads', type_='unique')
    op.drop_constraint('uq_invoices_id_company', 'invoices', type_='unique')
    op.drop_constraint('uq_employees_id_company', 'employees', type_='unique')
    op.drop_constraint('uq_customers_id_company', 'customers', type_='unique')
    op.drop_constraint('uq_ai_conversations_id_company', 'ai_conversations', type_='unique')

-- Admin audit logs table
-- Immutable log of administrative and security-relevant actions

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- login, submission_review, points_adjust, reward_manage, etc.
    target_type TEXT NOT NULL, -- submission, user, reward, device, etc.
    target_id UUID, -- ID of the target entity (nullable for system-wide actions)
    changes JSONB NOT NULL, -- Detailed changes made (before/after for updates)
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    ip_address INET,
    user_agent TEXT,
    session_id TEXT, -- Correlation ID for related actions
    outcome TEXT NOT NULL DEFAULT 'success', -- success, failure, partial
    failure_reason TEXT, -- If outcome is failure

    -- Constraints
    CONSTRAINT chk_action_type_valid CHECK (
        action_type IN (
            'login',
            'logout',
            'password_change',
            'submission_review',
            'submission_override',
            'points_adjust',
            'points_expiration',
            'reward_create',
            'reward_update',
            'reward_delete',
            'reward_inventory_update',
            'device_register',
            'device_update',
            'device_decommission',
            'system_config_change',
            'bulk_user_action',
            'data_export',
            'data_deletion_request',
            'api_key_rotation',
            'security_incident'
        )
    ),
    CONSTRAINT chk_target_type_valid CHECK (
        target_type IN (
            'submission',
            'user',
            'reward',
            'device',
            'iot_event',
            'recycling_center',
            'system',
            'api_key',
            'audit_log'
        )
    ),
    CONSTRAINT chk_outcome_valid CHECK (
        outcome IN ('success', 'failure', 'partial')
    )
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user_id ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_timestamp ON admin_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action_type ON admin_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_type ON admin_audit_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_id ON admin_audit_logs(target_id) WHERE target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_ip_address ON admin_audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_outcome ON admin_audit_logs(outcome);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_session_id ON admin_audit_logs(session_id) WHERE session_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_audit_logs (Append-only, viewable by admins only)
CREATE POLICY "Admins can view audit logs"
ON admin_audit_logs FOR SELECT
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text IN ('admin', 'moderator')
));

CREATE POLICY "Service can insert audit logs"
ON admin_audit_logs FOR INSERT
USING (auth.role() = 'service');

CREATE POLICY "Audit logs are immutable"
ON admin_audit_logs FOR UPDATE OR DELETE
USING (false);
-- IoT events table
-- Telemetry and events from IoT devices

CREATE TABLE IF NOT EXISTS iot_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES iot_devices(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- deposit, weight_change, tamper, environmental, connectivity
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    weight_grams INTEGER, -- Measured weight in grams
    fill_level_before INTEGER, -- Percentage before event
    fill_level_after INTEGER, -- Percentage after event
    image_url TEXT, -- Optional captured image
    sensor_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Raw sensor readings
    processed BOOLEAN DEFAULT FALSE NOT NULL, -- Whether event has been processed into submission
    related_submission UUID REFERENCES submissions(id) ON DELETE SET NULL, -- Foreign key to submissions (if processed)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT chk_event_type_valid CHECK (
        event_type IN (
            'deposit',
            'weight_change',
            'tamper',
            'environmental',
            'connectivity',
            'maintenance',
            'full_alert'
        )
    ),
    CONSTRAINT chk_weight_grams_nonnegative CHECK (weight_grams IS NULL OR weight_grams >= 0),
    CONSTRAINT chk_fill_level_before_range CHECK (fill_level_before IS NULL OR (fill_level_before >= 0 AND fill_level_before <= 100)),
    CONSTRAINT chk_fill_level_after_range CHECK (fill_level_after IS NULL OR (fill_level_after >= 0 AND fill_level_after <= 100)),
    CONSTRAINT chk_image_url_format CHECK (image_url IS NULL OR image_url ~* '^https?://')
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_iot_events_device_id ON iot_events(device_id);
CREATE INDEX IF NOT EXISTS idx_iot_events_timestamp ON iot_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_iot_events_event_type ON iot_events(event_type);
CREATE INDEX IF NOT EXISTS idx_iot_events_processed ON iot_events(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_iot_events_related_submission ON iot_events(related_submission) WHERE related_submission IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_iot_events_device_timestamp ON iot_events(device_id, timestamp DESC);

-- Enable Row Level Security
ALTER TABLE iot_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for iot_events
CREATE POLICY "Users can view events from own devices"
ON iot_events FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM iot_devices
        WHERE iot_devices.id = iot_events.device_id
        AND iot_devices.user_id = auth.uid()
    )
);

CREATE POLICY "Public can view events from public devices"
ON iot_events FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM iot_devices
        WHERE iot_devices.id = iot_events.device_id
        AND iot_devices.user_id IS NULL
    )
);

CREATE POLICY "Admins can view all events"
ON iot_events FOR SELECT
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text IN ('admin', 'moderator')
));

CREATE POLICY "Service can insert events"
ON iot_events FOR INSERT
USING (auth.role() = 'service');
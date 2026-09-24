-- IoT devices table
-- Information about smart recycling bins and other IoT devices

CREATE TABLE IF NOT EXISTS iot_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT UNIQUE NOT NULL, -- Unique device identifier
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- NULL for public bins
    name TEXT NOT NULL,
    description TEXT,
    device_type TEXT NOT NULL, -- smart_bin, collection_truck, sensor_station, etc.
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    installation_date TIMESTAMP WITH TIME ZONE NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    battery_level INTEGER, -- Percentage remaining (0-100)
    fill_level INTEGER, -- Current capacity percentage (0-100)
    status TEXT NOT NULL DEFAULT 'active', -- active, maintenance, inactive, lost
    firmware_version TEXT,
    capabilities JSONB NOT NULL DEFAULT '[]'::jsonb, -- Supported sensors and features
    configuration JSONB DEFAULT '{}'::jsonb, -- Device-specific configuration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_maintenance_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT chk_battery_level_range CHECK (battery_level IS NULL OR (battery_level >= 0 AND battery_level <= 100)),
    CONSTRAINT chk_fill_level_range CHECK (fill_level IS NULL OR (fill_level >= 0 AND fill_level <= 100)),
    CONSTRAINT chk_status_valid CHECK (
        status IN ('active', 'maintenance', 'inactive', 'lost')
    ),
    CONSTRAINT chk_device_type_valid CHECK (
        device_type IN (
            'smart_bin',
            'collection_truck',
            'sensor_station',
            'reverse_vending_machine',
            'compactor',
            'sorting_system'
        )
    )
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_iot_devices_user_id ON iot_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_iot_devices_location ON iot_devices USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_iot_devices_status ON iot_devices(status);
CREATE INDEX IF NOT EXISTS idx_iot_devices_last_seen ON iot_devices(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_iot_devices_device_type ON iot_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_iot_devices_battery_level ON iot_devices(battery_level) WHERE battery_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_iot_devices_fill_level ON iot_devices(fill_level) WHERE fill_level IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE iot_devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for iot_devices
CREATE POLICY "Users can view own devices"
ON iot_devices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own devices"
ON iot_devices FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Public can view active public devices"
ON iot_devices FOR SELECT
USING (user_id IS NULL AND status = 'active');

CREATE POLICY "Admins can manage all devices"
ON iot_devices FOR ALL
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text IN ('admin', 'moderator')
));
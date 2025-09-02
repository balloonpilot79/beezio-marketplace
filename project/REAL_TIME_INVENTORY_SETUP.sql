-- Real-Time Inventory & Pricing Database Setup
-- This file sets up the infrastructure for dynamic inventory management and pricing optimization

-- 1. Create inventory tracking table
CREATE TABLE IF NOT EXISTS product_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT,
    
    -- Stock levels
    current_stock INTEGER NOT NULL DEFAULT 0,
    reserved_stock INTEGER NOT NULL DEFAULT 0, -- Items in pending orders
    available_stock INTEGER GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,
    minimum_stock INTEGER DEFAULT 0, -- Reorder threshold
    maximum_stock INTEGER, -- Maximum storage capacity
    
    -- Warehouse/Location info
    warehouse_location TEXT,
    storage_zone TEXT,
    
    -- Tracking info
    last_restock_date TIMESTAMP WITH TIME ZONE,
    last_stock_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_restock_date TIMESTAMP WITH TIME ZONE,
    
    -- Supplier info
    supplier_id UUID, -- Could reference a suppliers table
    supplier_sku TEXT,
    lead_time_days INTEGER DEFAULT 7,
    
    -- Automated reordering
    auto_reorder_enabled BOOLEAN DEFAULT false,
    reorder_quantity INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(product_id, warehouse_location),
    CONSTRAINT positive_stock CHECK (current_stock >= 0),
    CONSTRAINT valid_reserved CHECK (reserved_stock >= 0 AND reserved_stock <= current_stock)
);

-- 2. Create stock movement history
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES product_inventory(id) ON DELETE CASCADE,
    
    -- Movement details
    movement_type TEXT NOT NULL CHECK (movement_type IN (
        'stock_in', 'stock_out', 'reserved', 'unreserved', 
        'returned', 'damaged', 'adjustment', 'transfer'
    )),
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    
    -- Reference information
    reference_type TEXT, -- 'order', 'restock', 'adjustment', etc.
    reference_id UUID, -- Order ID, restock ID, etc.
    
    -- Additional info
    reason TEXT,
    notes TEXT,
    performed_by UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create dynamic pricing table
CREATE TABLE IF NOT EXISTS dynamic_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    
    -- Base pricing
    base_price DECIMAL(10,2) NOT NULL,
    current_price DECIMAL(10,2) NOT NULL,
    minimum_price DECIMAL(10,2), -- Price floor
    maximum_price DECIMAL(10,2), -- Price ceiling
    
    -- Pricing rules
    demand_multiplier DECIMAL(5,4) DEFAULT 1.0000, -- Based on demand
    inventory_multiplier DECIMAL(5,4) DEFAULT 1.0000, -- Based on stock levels
    competition_multiplier DECIMAL(5,4) DEFAULT 1.0000, -- Based on competitor prices
    seasonal_multiplier DECIMAL(5,4) DEFAULT 1.0000, -- Seasonal adjustments
    
    -- Pricing strategy
    strategy TEXT DEFAULT 'static' CHECK (strategy IN (
        'static', 'dynamic_demand', 'inventory_based', 'competitive', 'seasonal', 'ml_optimized'
    )),
    
    -- Auto-adjustment settings
    auto_adjust_enabled BOOLEAN DEFAULT false,
    adjustment_frequency_hours INTEGER DEFAULT 24,
    last_adjustment TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_adjustment TIMESTAMP WITH TIME ZONE,
    
    -- Performance tracking
    conversion_rate DECIMAL(5,4), -- Recent conversion rate at current price
    price_elasticity DECIMAL(5,4), -- How sensitive demand is to price changes
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(product_id),
    CONSTRAINT valid_price_range CHECK (
        current_price >= 0 AND 
        (minimum_price IS NULL OR current_price >= minimum_price) AND
        (maximum_price IS NULL OR current_price <= maximum_price)
    )
);

-- 4. Create pricing history for analytics
CREATE TABLE IF NOT EXISTS pricing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    
    old_price DECIMAL(10,2) NOT NULL,
    new_price DECIMAL(10,2) NOT NULL,
    price_change_percent DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN old_price > 0 THEN ((new_price - old_price) / old_price * 100)
            ELSE 0
        END
    ) STORED,
    
    -- Reason for change
    change_reason TEXT NOT NULL CHECK (change_reason IN (
        'manual', 'demand_increase', 'demand_decrease', 'low_inventory', 
        'high_inventory', 'competitor_match', 'seasonal_adjustment', 
        'promotion', 'cost_change', 'algorithm'
    )),
    
    -- Performance before/after
    views_before INTEGER DEFAULT 0,
    sales_before INTEGER DEFAULT 0,
    conversion_before DECIMAL(5,4),
    
    -- Context
    inventory_level INTEGER,
    demand_score DECIMAL(5,2),
    competitor_avg_price DECIMAL(10,2),
    
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create demand forecasting table
CREATE TABLE IF NOT EXISTS demand_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    
    -- Forecast period
    forecast_date DATE NOT NULL,
    forecast_type TEXT NOT NULL CHECK (forecast_type IN ('daily', 'weekly', 'monthly')),
    
    -- Predicted demand
    predicted_demand INTEGER NOT NULL,
    confidence_level DECIMAL(5,2), -- 0-100 confidence percentage
    
    -- Factors considered
    historical_sales INTEGER,
    trend_factor DECIMAL(5,4),
    seasonal_factor DECIMAL(5,4),
    event_factor DECIMAL(5,4), -- Special events, holidays, etc.
    
    -- Model info
    model_version TEXT,
    created_by_algorithm TEXT,
    
    -- Validation (filled in after forecast period)
    actual_demand INTEGER,
    accuracy_score DECIMAL(5,2), -- How accurate the forecast was
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(product_id, forecast_date, forecast_type)
);

-- 6. Create low stock alerts table
CREATE TABLE IF NOT EXISTS stock_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES product_inventory(id) ON DELETE CASCADE,
    
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'low_stock', 'out_of_stock', 'overstock', 'reorder_due', 'expired_stock'
    )),
    
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    current_stock INTEGER NOT NULL,
    threshold_stock INTEGER,
    
    message TEXT NOT NULL,
    
    -- Resolution
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    
    -- Notification tracking
    notification_sent BOOLEAN DEFAULT false,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_inventory_product_id ON product_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_product_inventory_available_stock ON product_inventory(available_stock);
CREATE INDEX IF NOT EXISTS idx_product_inventory_minimum_stock ON product_inventory(minimum_stock);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_product_id ON dynamic_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_next_adjustment ON dynamic_pricing(next_adjustment);
CREATE INDEX IF NOT EXISTS idx_pricing_history_product_id ON pricing_history(product_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_created_at ON pricing_history(created_at);
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_product_date ON demand_forecasts(product_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_unresolved ON stock_alerts(is_resolved, severity) WHERE NOT is_resolved;

-- 8. Function to update stock levels
CREATE OR REPLACE FUNCTION update_product_stock(
    product_id_param UUID,
    quantity_change INTEGER,
    movement_type_param TEXT,
    reference_type_param TEXT DEFAULT NULL,
    reference_id_param UUID DEFAULT NULL,
    notes_param TEXT DEFAULT NULL,
    warehouse_location_param TEXT DEFAULT 'main'
) RETURNS UUID AS $$
DECLARE
    inventory_record RECORD;
    movement_id UUID;
    old_stock INTEGER;
    new_stock INTEGER;
BEGIN
    -- Get current inventory record
    SELECT * INTO inventory_record 
    FROM product_inventory 
    WHERE product_id = product_id_param 
      AND warehouse_location = warehouse_location_param;
    
    IF NOT FOUND THEN
        -- Create new inventory record
        INSERT INTO product_inventory (product_id, current_stock, warehouse_location)
        VALUES (product_id_param, GREATEST(0, quantity_change), warehouse_location_param)
        RETURNING * INTO inventory_record;
        
        old_stock := 0;
        new_stock := GREATEST(0, quantity_change);
    ELSE
        old_stock := inventory_record.current_stock;
        new_stock := GREATEST(0, old_stock + quantity_change);
        
        -- Update stock
        UPDATE product_inventory 
        SET current_stock = new_stock,
            last_stock_check = NOW(),
            updated_at = NOW()
        WHERE id = inventory_record.id;
    END IF;
    
    -- Record stock movement
    INSERT INTO stock_movements (
        product_id, inventory_id, movement_type, quantity, 
        previous_stock, new_stock, reference_type, reference_id, 
        notes, performed_by
    ) VALUES (
        product_id_param, inventory_record.id, movement_type_param, 
        quantity_change, old_stock, new_stock, reference_type_param, 
        reference_id_param, notes_param, auth.uid()
    ) RETURNING id INTO movement_id;
    
    -- Check for low stock alerts
    PERFORM check_stock_alerts(product_id_param, warehouse_location_param);
    
    RETURN movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to reserve stock for orders
CREATE OR REPLACE FUNCTION reserve_product_stock(
    product_id_param UUID,
    quantity_param INTEGER,
    order_id_param UUID,
    warehouse_location_param TEXT DEFAULT 'main'
) RETURNS BOOLEAN AS $$
DECLARE
    available_qty INTEGER;
BEGIN
    -- Check available stock
    SELECT available_stock INTO available_qty
    FROM product_inventory
    WHERE product_id = product_id_param 
      AND warehouse_location = warehouse_location_param;
    
    IF available_qty IS NULL OR available_qty < quantity_param THEN
        RETURN false; -- Insufficient stock
    END IF;
    
    -- Reserve the stock
    UPDATE product_inventory
    SET reserved_stock = reserved_stock + quantity_param,
        updated_at = NOW()
    WHERE product_id = product_id_param 
      AND warehouse_location = warehouse_location_param;
    
    -- Record the reservation
    PERFORM update_product_stock(
        product_id_param, 
        0, -- No change to current stock
        'reserved',
        'order',
        order_id_param,
        format('Reserved %s units for order', quantity_param),
        warehouse_location_param
    );
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to check and create stock alerts
CREATE OR REPLACE FUNCTION check_stock_alerts(
    product_id_param UUID,
    warehouse_location_param TEXT DEFAULT 'main'
) RETURNS VOID AS $$
DECLARE
    inventory_record RECORD;
    alert_message TEXT;
    alert_severity TEXT;
BEGIN
    -- Get inventory info
    SELECT pi.*, p.title 
    INTO inventory_record
    FROM product_inventory pi
    JOIN products p ON pi.product_id = p.id
    WHERE pi.product_id = product_id_param 
      AND pi.warehouse_location = warehouse_location_param;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Check for various alert conditions
    
    -- Out of stock
    IF inventory_record.available_stock = 0 THEN
        alert_message := format('Product "%s" is out of stock in %s warehouse', 
                               inventory_record.title, warehouse_location_param);
        alert_severity := 'critical';
        
        INSERT INTO stock_alerts (product_id, inventory_id, alert_type, severity, 
                                 current_stock, message)
        VALUES (product_id_param, inventory_record.id, 'out_of_stock', 
                alert_severity, inventory_record.available_stock, alert_message)
        ON CONFLICT DO NOTHING;
    
    -- Low stock
    ELSIF inventory_record.available_stock <= inventory_record.minimum_stock 
          AND inventory_record.minimum_stock > 0 THEN
        alert_message := format('Product "%s" is low on stock (%s remaining, minimum %s)', 
                               inventory_record.title, inventory_record.available_stock, 
                               inventory_record.minimum_stock);
        alert_severity := CASE 
            WHEN inventory_record.available_stock <= (inventory_record.minimum_stock * 0.5) THEN 'high'
            ELSE 'medium'
        END;
        
        INSERT INTO stock_alerts (product_id, inventory_id, alert_type, severity, 
                                 current_stock, threshold_stock, message)
        VALUES (product_id_param, inventory_record.id, 'low_stock', 
                alert_severity, inventory_record.available_stock, 
                inventory_record.minimum_stock, alert_message)
        ON CONFLICT DO NOTHING;
    
    -- Reorder due
    ELSIF inventory_record.auto_reorder_enabled 
          AND inventory_record.available_stock <= inventory_record.minimum_stock THEN
        alert_message := format('Product "%s" needs reordering (current: %s, reorder at: %s)', 
                               inventory_record.title, inventory_record.available_stock, 
                               inventory_record.minimum_stock);
        
        INSERT INTO stock_alerts (product_id, inventory_id, alert_type, severity, 
                                 current_stock, threshold_stock, message)
        VALUES (product_id_param, inventory_record.id, 'reorder_due', 
                'medium', inventory_record.available_stock, 
                inventory_record.minimum_stock, alert_message)
        ON CONFLICT DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 11. Function to update dynamic pricing
CREATE OR REPLACE FUNCTION update_dynamic_pricing(
    product_id_param UUID,
    demand_factor DECIMAL(5,4) DEFAULT 1.0000,
    inventory_factor DECIMAL(5,4) DEFAULT 1.0000,
    competition_factor DECIMAL(5,4) DEFAULT 1.0000
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    pricing_record RECORD;
    new_price DECIMAL(10,2);
    old_price DECIMAL(10,2);
BEGIN
    -- Get current pricing info
    SELECT * INTO pricing_record
    FROM dynamic_pricing
    WHERE product_id = product_id_param;
    
    IF NOT FOUND THEN
        RETURN NULL; -- No pricing strategy set
    END IF;
    
    old_price := pricing_record.current_price;
    
    -- Calculate new price based on strategy
    CASE pricing_record.strategy
        WHEN 'dynamic_demand' THEN
            new_price := pricing_record.base_price * demand_factor;
        WHEN 'inventory_based' THEN
            new_price := pricing_record.base_price * inventory_factor;
        WHEN 'competitive' THEN
            new_price := pricing_record.base_price * competition_factor;
        ELSE
            new_price := pricing_record.base_price; -- Static pricing
    END CASE;
    
    -- Apply multipliers
    new_price := new_price * pricing_record.demand_multiplier 
                          * pricing_record.inventory_multiplier 
                          * pricing_record.competition_multiplier
                          * pricing_record.seasonal_multiplier;
    
    -- Enforce price bounds
    IF pricing_record.minimum_price IS NOT NULL AND new_price < pricing_record.minimum_price THEN
        new_price := pricing_record.minimum_price;
    END IF;
    
    IF pricing_record.maximum_price IS NOT NULL AND new_price > pricing_record.maximum_price THEN
        new_price := pricing_record.maximum_price;
    END IF;
    
    -- Update pricing if changed
    IF ABS(new_price - old_price) > 0.01 THEN -- Only update if change > 1 cent
        UPDATE dynamic_pricing
        SET current_price = new_price,
            last_adjustment = NOW(),
            next_adjustment = NOW() + (pricing_record.adjustment_frequency_hours || ' hours')::INTERVAL,
            updated_at = NOW()
        WHERE product_id = product_id_param;
        
        -- Update product table
        UPDATE products 
        SET price = new_price 
        WHERE id = product_id_param;
        
        -- Record pricing history
        INSERT INTO pricing_history (
            product_id, old_price, new_price, change_reason, 
            inventory_level, changed_by
        ) VALUES (
            product_id_param, old_price, new_price, 'algorithm',
            (SELECT available_stock FROM product_inventory WHERE product_id = product_id_param LIMIT 1),
            auth.uid()
        );
    END IF;
    
    RETURN new_price;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Function to get product availability status
CREATE OR REPLACE FUNCTION get_product_availability(product_id_param UUID)
RETURNS TABLE (
    product_id UUID,
    total_stock INTEGER,
    available_stock INTEGER,
    reserved_stock INTEGER,
    availability_status TEXT,
    estimated_restock_date TIMESTAMP WITH TIME ZONE,
    can_order BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pi.product_id,
        pi.current_stock as total_stock,
        pi.available_stock,
        pi.reserved_stock,
        CASE 
            WHEN pi.available_stock = 0 THEN 'out_of_stock'
            WHEN pi.available_stock <= pi.minimum_stock THEN 'low_stock'
            WHEN pi.available_stock > pi.minimum_stock THEN 'in_stock'
            ELSE 'unknown'
        END as availability_status,
        pi.next_restock_date as estimated_restock_date,
        pi.available_stock > 0 as can_order
    FROM product_inventory pi
    WHERE pi.product_id = product_id_param;
END;
$$ LANGUAGE plpgsql;

-- 13. Analytics views
CREATE OR REPLACE VIEW inventory_analytics AS
SELECT 
    p.id as product_id,
    p.title,
    p.category,
    pi.current_stock,
    pi.available_stock,
    pi.reserved_stock,
    pi.minimum_stock,
    
    -- Stock status
    CASE 
        WHEN pi.available_stock = 0 THEN 'out_of_stock'
        WHEN pi.available_stock <= pi.minimum_stock THEN 'low_stock'
        ELSE 'in_stock'
    END as stock_status,
    
    -- Days until restock needed (estimated)
    CASE 
        WHEN pi.available_stock > 0 AND pi.minimum_stock > 0 THEN 
            GREATEST(0, (pi.available_stock - pi.minimum_stock))
        ELSE 0
    END as days_until_restock,
    
    -- Recent stock movements
    (SELECT COUNT(*) 
     FROM stock_movements sm 
     WHERE sm.product_id = p.id 
       AND sm.created_at >= NOW() - INTERVAL '7 days') as movements_last_7_days,
    
    pi.last_stock_check,
    pi.next_restock_date
FROM products p
LEFT JOIN product_inventory pi ON p.id = pi.product_id;

CREATE OR REPLACE VIEW pricing_analytics AS
SELECT 
    p.id as product_id,
    p.title,
    p.price as current_price,
    dp.base_price,
    dp.minimum_price,
    dp.maximum_price,
    dp.strategy as pricing_strategy,
    
    -- Price change info
    (SELECT ph.old_price 
     FROM pricing_history ph 
     WHERE ph.product_id = p.id 
     ORDER BY ph.created_at DESC 
     LIMIT 1) as previous_price,
    
    -- Recent price changes
    (SELECT COUNT(*) 
     FROM pricing_history ph 
     WHERE ph.product_id = p.id 
       AND ph.created_at >= NOW() - INTERVAL '30 days') as price_changes_last_30_days,
    
    dp.conversion_rate,
    dp.price_elasticity,
    dp.last_adjustment,
    dp.next_adjustment
FROM products p
LEFT JOIN dynamic_pricing dp ON p.id = dp.product_id;

-- 14. Triggers for automatic updates
CREATE OR REPLACE FUNCTION trigger_update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inventory_timestamp
    BEFORE UPDATE ON product_inventory
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_inventory_timestamp();

CREATE TRIGGER update_pricing_timestamp
    BEFORE UPDATE ON dynamic_pricing
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_inventory_timestamp();

-- 15. Enable RLS
ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Sellers can manage their product inventory" ON product_inventory
    FOR ALL USING (
        product_id IN (SELECT id FROM products WHERE seller_id = auth.uid())
    );

CREATE POLICY "Public can view product availability" ON product_inventory
    FOR SELECT USING (true);

CREATE POLICY "Sellers can view their stock movements" ON stock_movements
    FOR SELECT USING (
        product_id IN (SELECT id FROM products WHERE seller_id = auth.uid())
    );

CREATE POLICY "Sellers can manage their product pricing" ON dynamic_pricing
    FOR ALL USING (
        product_id IN (SELECT id FROM products WHERE seller_id = auth.uid())
    );

CREATE POLICY "Public can view current pricing" ON dynamic_pricing
    FOR SELECT USING (true);

-- Admin policies
CREATE POLICY "Admins have full access to inventory" ON product_inventory
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins have full access to pricing" ON dynamic_pricing
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL VIEWS IN SCHEMA public TO authenticated;

COMMENT ON TABLE product_inventory IS 'Real-time inventory tracking with warehouse locations and automated alerts';
COMMENT ON TABLE dynamic_pricing IS 'AI-powered dynamic pricing with multiple adjustment strategies';
COMMENT ON TABLE stock_movements IS 'Complete audit trail of all inventory changes';
COMMENT ON TABLE demand_forecasts IS 'ML-powered demand forecasting for inventory planning';
COMMENT ON FUNCTION update_product_stock IS 'Safely update product stock levels with full audit trail';
COMMENT ON FUNCTION reserve_product_stock IS 'Reserve inventory for pending orders';
COMMENT ON FUNCTION update_dynamic_pricing IS 'Apply dynamic pricing strategies with market factors';

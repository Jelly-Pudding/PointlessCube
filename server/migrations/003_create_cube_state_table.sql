CREATE TABLE IF NOT EXISTS cube_state (
    id INT PRIMARY KEY DEFAULT 1,
    layers JSONB NOT NULL,
    current_layer INT NOT NULL DEFAULT 1,
    CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO cube_state (id, layers, current_layer)
VALUES (1, '[]'::jsonb, 1)
ON CONFLICT (id) DO NOTHING;

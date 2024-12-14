CREATE TABLE IF NOT EXISTS game_state (
    id INT PRIMARY KEY DEFAULT 1,
    current_layer INT NOT NULL DEFAULT 1,
    CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO game_state (id, current_layer)
VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_settings(key,value,updated_at) VALUES
('game_pinball_enabled','true',0),
('game_pool_enabled','true',0),
('game_slots_enabled','true',0),
('game_memory_enabled','true',0),
('game_reactor_enabled','true',0),
('game_sequence_enabled','true',0)
ON CONFLICT(key) DO NOTHING;

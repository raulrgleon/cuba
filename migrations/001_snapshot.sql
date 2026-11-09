CREATE TABLE boundaries (
    id TEXT PRIMARY KEY,
    level TEXT NOT NULL CHECK (level IN ('ADM1', 'ADM2')),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0)
);
CREATE TABLE observations (
    indicator TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 2100),
    value REAL NOT NULL,
    PRIMARY KEY (indicator, year)
);

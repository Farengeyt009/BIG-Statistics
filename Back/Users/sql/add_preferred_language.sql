IF COL_LENGTH('Users.Users', 'preferred_language') IS NULL
BEGIN
    ALTER TABLE Users.Users
    ADD preferred_language NVARCHAR(5) NOT NULL
        CONSTRAINT DF_Users_preferred_language DEFAULT ('en');
    PRINT 'Column preferred_language added to Users.Users';
END
GO

UPDATE Users.Users
SET preferred_language = 'en'
WHERE preferred_language IS NULL OR preferred_language = '';
GO


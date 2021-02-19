#### A discord.js bot made for easily posting and managing in-game sales in FFXIV

I created this bot to be hosted on Heroku with a PostgreSQL database, the schema I used is below.

##### Schema
```
                                  Table "public.sale"
      Column      |   Type   | Collation | Nullable |             Default
------------------+----------+-----------+----------+----------------------------------
 id               | smallint |           | not null | nextval('sale_id_seq'::regclass)
 duty             | text     |           |          |
 price            | text     |           |          |
 dc               | dc       |           |          |
 tanks            | smallint |           |          | 0
 healers          | smallint |           |          | 0
 dps              | smallint |           |          | 0
 any_role         | smallint |           |          | 0
 time             | text     |           |          |
 notes            | text     |           |          |
 sale_posted_date | date     |           | not null | CURRENT_DATE
 full             | boolean  |           |          | false
 user_id          | bigint   |           |          |

                  Table "public.saleuser"
    Column     |   Type   | Collation | Nullable | Default
---------------+----------+-----------+----------+---------
 sale_id       | smallint |           |          |
 role          | role     |           |          |
 user_id       | bigint   |           |          |
 role_priority | smallint |           |          |
```
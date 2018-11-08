alter table job add column  starttime   datetime NOT NULL;
alter table job add column  runtime     int default 0 NOT NULL;
alter table job add column  host        varchar(64) NOT NULL default '';
alter table job add column  process_id  int(11) NOT NULL default '0';



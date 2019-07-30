/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `user_id` int(11) NOT NULL auto_increment,
  `user_uuid` varchar(64),
  `email_identity` text NOT NULL,
  `openID` text,
  `password_hash` text NOT NULL,
  `email_address` text NOT NULL,
  `nickname` varchar(255) NOT NULL default '',
  `hmac_secretkey` text NOT NULL default '',
  PRIMARY KEY  (`user_id`),
  UNIQUE KEY `uuid_unq` (`user_uuid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Table structure for table `user_2_metadata`
--

CREATE TABLE `user_2_metadata` (
  `user_id` int(11) default NULL,
  `metadata_id` int(11) default NULL,
  UNIQUE KEY `user_metadata_unq` USING BTREE (`user_id`,`metadata_id`),
  KEY `user_id` (`user_id`),
  KEY `metadata_id` (`metadata_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Table structure for table `user_2_symbol`
--

CREATE TABLE `user_2_symbol` (
  `user_id` int(11) default NULL,
  `symbol_id` int(11) default NULL,
  UNIQUE KEY `user_symbol_unq` (`user_id`,`symbol_id`),
  KEY `user_id` (`user_id`),
  KEY `symbol_id` (`symbol_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;


CREATE TABLE `user_authentication` (
  `user_id` int(11) default NULL,
  `openID` text NOT NULL
);


CREATE TABLE `user_email_validation` (
  `email` varchar(255) NOT NULL,
  `validation_code` text NOT NULL,
  `create_time` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `user_id` int(11) default NULL
);


--
-- Table structure for table `collaboration`
--

CREATE TABLE `collaboration` (
  `collaboration_id` int(11) NOT NULL auto_increment,
  `display_name` varchar(255) NOT NULL default '',
  `uuid` varchar(48) NOT NULL default '',
  `owner_user_id` int(11) NOT NULL,
  `owner_openid` varchar(255) NOT NULL default '',
  `public_announce` char(1) NOT NULL default '',
  `open_to_public` char(1) NOT NULL default '',
  PRIMARY KEY  (`collaboration_id`),
  UNIQUE KEY `uniq_uuid` USING BTREE (`uuid`),
  KEY `openid_idx` (`owner_openid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Table structure for table `collaboration_2_metadata`
--

CREATE TABLE `collaboration_2_metadata` (
  `collaboration_id` int(11) default NULL,
  `metadata_id` int(11) default NULL,
  UNIQUE KEY `collab_metadata_unq` USING BTREE (`collaboration_id`,`metadata_id`),
  KEY `metadata_id` (`metadata_id`),
  KEY `collaboration_id` USING BTREE (`collaboration_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Table structure for table `collaboration_2_symbol`
--

CREATE TABLE `collaboration_2_symbol` (
  `collaboration_id` int(11) default NULL,
  `symbol_id` int(11) default NULL,
  UNIQUE KEY `collab_symbol_unq` USING BTREE (`collaboration_id`,`symbol_id`),
  KEY `symbol_id` (`symbol_id`),
  KEY `collaboration_id` USING BTREE (`collaboration_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Table structure for table `collaboration_2_user`
--

CREATE TABLE `collaboration_2_user` (
  `collaboration_id` int(11) NOT NULL default '0',
  `user_id` int(11) NOT NULL default '0',
  `member_status` enum('REQUEST','MEMBER','REJECTED','INACTIVE','INVITED') NOT NULL default 'REQUEST',
  PRIMARY KEY  (`collaboration_id`,`user_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Table structure for table `collaboration_2_configuration`
--

CREATE TABLE `collaboration_2_configuration` (
  `collaboration_id` int(11) NOT NULL default '0',
  `configuration_id` int(11) NOT NULL default '0',
  PRIMARY KEY  (`collaboration_id`,`configuration_id`),
  KEY `collaboration_id` (`collaboration_id`),
  KEY `configuration_id` (`configuration_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `id` varchar(64) NOT NULL default '',
  `a_session` text NOT NULL,
  PRIMARY KEY  (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;



--
-- Table structure for table `region_cache`
--

CREATE TABLE `region_cache` (
  `region_cache_id` int(11) NOT NULL auto_increment,
  `uuid`        char(48) NOT NULL default '',
  `assembly`    char(32) NOT NULL default '',
  `chrom`       char(64) default NULL,
  `start`       int(11) default NULL,
  `end`         int(11) default NULL,
  `hit_count`   int(11) NOT NULL default 1,
  `build_time`  int(11) NOT NULL default 0,
  `last_access` timestamp NOT NULL default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP,
  `cache_file`  text NOT NULL default '',
  
  PRIMARY KEY  (`region_cache_id`),
  UNIQUE KEY `region_cache_unq` (`uuid`,`assembly`, chrom, start, end)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;


CREATE TABLE `region_cache_2_metadata` (
  `region_cache_id` int(11) default NULL,
  `metadata_id` int(11) default NULL,
  UNIQUE KEY `regioncache_metadata_unq` USING BTREE (`region_cache_id`,`metadata_id`),
  KEY `region_cache_id` (`region_cache_id`),
  KEY `metadata_id` (`metadata_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;


CREATE TABLE `region_cache_history` (
  `region_cache_id` int(11) default NULL,
  `user_id` int(11) default NULL,
  `access_time` timestamp NOT NULL default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP,

  KEY `region_cache_id` (`region_cache_id`),
  KEY `user_id` (`user_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;


--
-- Table structure for table `track_cache` system
--

CREATE TABLE `track_cache` (
  `track_cache_id`    int(11) NOT NULL auto_increment,
  `hashkey`           char(128) NOT NULL default '',
  `hit_count`         int(11) NOT NULL default 1,
  `percent_complete`  float NOT NULL default 0,
  `last_access`       timestamp NOT NULL default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP,
  `cache_file`        text NOT NULL default '',
  `seg_buildtime`     double NOT NULL default 1,
  `broken`            char(1) NOT NULL default ' ',
  `remote_url`        text NOT NULL default '',  

  PRIMARY KEY  (`track_cache_id`),
  UNIQUE KEY `hashkey` (`hashkey`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;


CREATE TABLE `track_cache_2_metadata` (
  `track_cache_id` int(11) default NULL,
  `metadata_id`    int(11) default NULL,
  
  UNIQUE KEY `trackcache_metadata_unq` (`track_cache_id`,`metadata_id`),
  KEY `track_cache_id` (`track_cache_id`),
  KEY `metadata_id` (`metadata_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;


CREATE TABLE `track_cache_history` (
  `track_cache_id` int(11) default NULL,
  `user_id` int(11) default NULL,
  `assembly` char(32) NOT NULL default '',
  `chrom` char(64) default NULL,
  `start` int(11) default NULL,
  `end` int(11) default NULL,
  `needs_build` char(1) NOT NULL default '',
  `is_download` char(1) NOT NULL default '',
  `access_time` timestamp NOT NULL default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP,
  KEY `track_cache_id` (`track_cache_id`),
  KEY `user_id` (`user_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;


CREATE TABLE `track_request` (
  `track_request_id` int(11) NOT NULL auto_increment,
  `track_cache_id` int(11) default NULL,
  `user_id` int(11) default NULL,
  `assembly` char(32) NOT NULL default '',
  `chrom` char(64) default NULL,
  `start` int(11) default NULL,
  `end` int(11) default NULL,
  `num_segs` int(11) default NULL,
  `unbuilt` int(11) default NULL,
  `send_email` char(1) NOT NULL default '',
  `request_time` timestamp NOT NULL default CURRENT_TIMESTAMP,
  `view_uuid` text NOT NULL default '',
  `track_name` text NOT NULL default '',
  
  PRIMARY KEY  (`track_request_id`),
  KEY `track_cache_id` (`track_cache_id`),
  KEY `user_id` (`user_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;


--
-- Table structure for table `track_builder`
--

CREATE TABLE `track_builder` (
  `track_builder_id` int(11) NOT NULL auto_increment,
  `track_cache_id` int(11) NOT NULL,
  `host` varchar(64) NOT NULL default '',
  `process_id` int(11) NOT NULL default '0',
  `work_done` int(11) NOT NULL default '0',
  `born` datetime NOT NULL,
  `last_check_in` datetime NOT NULL,
  `died` datetime default NULL,
  `cause_of_death` enum('','NO_WORK','JOB_LIMIT','LIFESPAN','FATALITY') NOT NULL default '',
  PRIMARY KEY  (`track_builder_id`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=latin1;


--
-- Table structure for table `configuration` system
--

CREATE TABLE `configuration` (
  `configuration_id` int(11) NOT NULL auto_increment,
  `user_id`          int(11) default -1,
  `uuid`             char(64) NOT NULL default '',
  `fixed_id`         varchar(128),
  `config_type`      enum('VIEW','TRACK','SCRIPT','AUTOSAVE') NOT NULL default 'VIEW',
  `collaboration_id` int(11) default -1,
  `access_count`     int(11)  NOT NULL default 1,
  `create_date`      datetime default NULL,
  `last_access`      timestamp NOT NULL default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP,
  PRIMARY KEY  (`configuration_id`),
  KEY `config_type` (`config_type`),
  UNIQUE KEY `uniq_uuid` (`uuid`),
  UNIQUE KEY `fixed_id` (`fixed_id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 MIN_ROWS=10000000;


CREATE TABLE `configuration_2_metadata` (
  `configuration_id` int(11) default NULL,
  `metadata_id` int(11) default NULL,
  KEY `configuration_id` (`configuration_id`),
  KEY `metadata_id` (`metadata_id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 MIN_ROWS=10000000;

CREATE TABLE `configuration_2_symbol` (
  `configuration_id` int(11) default NULL,
  `symbol_id` int(11) default NULL,
  KEY `configuration_id` (`configuration_id`),
  KEY `symbol_id` (`symbol_id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 MIN_ROWS=10000000;

CREATE TABLE `configuration_fixed_editors` (
  `fixed_id` varchar(128) NOT NULL,
  `user_id` int(11) NOT NULL,
  `editor_status` enum('OWNER','EDITOR') NOT NULL default 'EDITOR',
  KEY `fixed_id` (`fixed_id`),
  KEY `user_id` (`user_id`),
  UNIQUE 'editor' (fixed_id, user_id)
);

CREATE TABLE `configuration_fixed_history` (
  `fixed_id`         varchar(128) NOT NULL,
  `configuration_id` int(11) NOT NULL,
  KEY `fixed_id` (`fixed_id`),
  KEY `configuration_id` (`configuration_id`)
);

--
-- Table structure for job queueing system
--

CREATE TABLE worker (
  worker_id        int NOT NULL auto_increment,
  analysis_id      int NOT NULL,
  beekeeper        varchar(80) DEFAULT '' NOT NULL,
  host             varchar(40) DEFAULT '' NOT NULL,
  process_id       varchar(40) DEFAULT '' NOT NULL,
  work_done        int DEFAULT '0' NOT NULL,
  born             datetime NOT NULL,
  last_check_in    datetime NOT NULL,
  died             datetime DEFAULT NULL,
  cause_of_death   enum('', 'NO_WORK', 'JOB_LIMIT', 'LIFESPAN', 'FATALITY') DEFAULT '' NOT NULL,
  PRIMARY KEY (worker_id)
);

CREATE TABLE analysis (
  analysis_id           int unsigned NOT NULL auto_increment, # unique internal id
  name                  varchar(255) not null,
  module                varchar(255),
  parameters            text,
  hive_capacity         int default 1 NOT NULL,
  status                enum('BLOCKED', 'LOADING', 'SYNCHING', 'READY', 'WORKING', 'ALL_CLAIMED', 'DONE') DEFAULT 'READY' NOT NULL,
  batch_size            int default 1 NOT NULL,
  avg_msec_per_job      int default 0 NOT NULL,                          
  total_job_count       int NOT NULL,
  unclaimed_job_count   int NOT NULL,
  done_job_count        int NOT NULL,
  failed_job_count      int NOT NULL,
  num_required_workers  int NOT NULL,
  last_update           datetime NOT NULL,
  sync_lock             int default 0 NOT NULL,
  
  PRIMARY KEY (analysis_id),
  KEY name_idx( name ),
  UNIQUE (name)
);

CREATE TABLE job_dataflow (
  dataflow_id           int unsigned not null auto_increment,
  from_analysis_id      int unsigned NOT NULL,
  to_analysis_id        int unsigned NOT NULL,
  branch_code           int default 1 NOT NULL,

  PRIMARY KEY (dataflow_id),
  UNIQUE (from_analysis_id, to_analysis_id)
);

CREATE TABLE job (
  job_id                    int NOT NULL auto_increment,
  analysis_id               int NOT NULL,
  user_id                   int NOT NULL,
  parameters                text,
  job_claim                 char(40) NOT NULL default '', #UUID
  worker_id                 int NOT NULL,
  status                    enum('READY','BLOCKED','CLAIMED','RUN','DONE','FAILED') DEFAULT 'READY' NOT NULL,
  retry_count               int default 0 not NULL,
  created timestamp         NOT NULL default CURRENT_TIMESTAMP,
  starttime                 datetime NOT NULL,
  completed                 datetime NOT NULL,
  runtime                   int default 0 NOT NULL,
  host                      varchar(64) NOT NULL default '',
  process_id                int(11) NOT NULL default '0',

  PRIMARY KEY                  (job_id),
  INDEX claim_analysis_status  (job_claim, analysis_id, status),
  INDEX analysis_status        (analysis_id, status),
  INDEX worker_id              (worker_id)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 MIN_ROWS=10000000;

CREATE TABLE job_2_metadata (
  job_id int(11) default NULL,
  metadata_id int(11) default NULL,
  KEY job_id (job_id),
  KEY metadata_id USING BTREE (metadata_id)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 MIN_ROWS=10000000;


/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;



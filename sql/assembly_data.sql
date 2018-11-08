-- MySQL dump 10.9
--
-- Host: osc-mysql.gsc.riken.jp    Database: eeDB_core
-- ------------------------------------------------------
-- Server version	4.1.20

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- for sqlite uncomment next line
-- begin transaction;  

--
-- Dumping data for table `taxon`
--
LOCK TABLES `taxon` WRITE;
/*!40000 ALTER TABLE `taxon` DISABLE KEYS */;
INSERT INTO `taxon` VALUES (10090,'Mus','musculus','NULL','House mouse','musculus Mus Murinae Muridae Sciurognathi Rodentia Glires Euarchontoglires Eutheria Mammalia Euteleostomi Vertebrata Craniata Chordata Metazoa Eukaryota');
INSERT INTO `taxon` VALUES (9606,'Homo','sapiens','NULL','Human','sapiens Homo Hominidae Catarrhini Primates Euarchontoglires Eutheria Mammalia Euteleostomi Vertebrata Craniata Chordata Metazoa Eukaryota');
INSERT INTO `taxon` VALUES (10116,'Rattus','norvegicus',NULL,'Norway rat','norvegicus Rattus Murinae Muridae Sciurognathi Rodentia Glires Euarchontoglires Eutheria Mammalia Euteleostomi Vertebrata Craniata Chordata Metazoa Eukaryota');
/*!40000 ALTER TABLE `taxon` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `assembly`
--
LOCK TABLES `assembly` WRITE;
/*!40000 ALTER TABLE `assembly` DISABLE KEYS */;
INSERT INTO `assembly` VALUES (1,9606,'36.2','hg18','hg18','2006-03-01','Homo sapiens','');
INSERT INTO `assembly` VALUES (2,10090,'37.2','mm9','mm9','2007-04-01','Mus musculus','');
INSERT INTO `assembly` VALUES (3,10116,'RGSC3.4','rn4','rn4','2004-12-01','Rattus norvegicus','');
INSERT INTO `assembly` VALUES (4,7955,'Zv8','danRer6','danRer6','2007-07-01','Danio rerio','');
INSERT INTO `assembly` VALUES (5,9606,'GRCh37','hg19','hg19','2009-02-01','Homo sapiens','');
INSERT INTO `assembly` VALUES (6,5476,NULL,'Ca21','Ca21',NULL,'Candida albicans','');
INSERT INTO `assembly` VALUES (7,9598,NULL,'panTro4','panTro4',NULL,'Pan_troglodytes','');
INSERT INTO `assembly` VALUES (8,99883,NULL,'TETRAODON8','TETRAODON8',NULL,'Tetraodon_nigroviridis','');
INSERT INTO `assembly` VALUES (9,99883,NULL,'tetNig1','tetNig1',NULL,'Tetraodon_nigroviridis','');
INSERT INTO `assembly` VALUES (10,9796,NULL,'equCab2','equCab2',NULL,'Equus_caballus','');
INSERT INTO `assembly` VALUES (11,NULL,NULL,'cneo040623','cneo040623',NULL,'Cryptococcus_neoformans','');
INSERT INTO `assembly` VALUES (12,3055,NULL,'Chlre4','Chlre4',NULL,'Chlamydomonas_reinhardtii','');
INSERT INTO `assembly` VALUES (13,15368,NULL,'Bd21','Bd21',NULL,'Brachypodium_distachyon','');
INSERT INTO `assembly` VALUES (14,7227,'BDGP_R5','dm3',NULL,NULL,'Drosophila melanogaster','');
INSERT INTO `assembly` VALUES (15,9823,'Sscrofa9.2','susScr2','susScr2',NULL,'Sus scrofa (pig)','');
INSERT INTO `assembly` VALUES (16,9544,'Mmul_051212','rheMac2','rheMac2','2005-12-12','Macaca mulatta','');
INSERT INTO `assembly` VALUES (18,7955,'Zv9','danRer7',NULL,'2008-12-01','Danio rerio','');
INSERT INTO `assembly` VALUES (19,7955,'Zv8','danRer6',NULL,'2008-12-01','Danio rerio','');
INSERT INTO `assembly` VALUES (20,9031,'galGal3','gg3','gg3','2006-05-00','Gallus gallus','');
INSERT INTO `assembly` VALUES (21,10090,'GRCm38','mm10','mm10','2012-01-09','Mus musculus','');
/*!40000 ALTER TABLE `assembly` ENABLE KEYS */;
UNLOCK TABLES;

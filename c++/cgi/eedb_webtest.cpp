#include <stdlib.h>
#include <stdio.h>
#include <string>
#include <math.h>
#include <sys/time.h>
#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_generators.hpp>
#include <boost/uuid/uuid_io.hpp>
#include "fcgi_stdio.h"

#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <MQDB/DBStream.h>
#include <EEDB/Assembly.h>
#include <EEDB/Chrom.h>
#include <EEDB/Metadata.h>
#include <EEDB/Symbol.h>
#include <EEDB/MetadataSet.h>
#include <EEDB/Datatype.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/Experiment.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Peer.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/Dummy.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>

#include <EEDB/WebServices/WebBase.h>

using namespace std;
using namespace MQDB;


//////////////////////////////////////////////////////////////////////////////////////

main() {
  EEDB::WebServices::WebBase*  webservice = new EEDB::WebServices::WebBase();

  webservice->init_config("server_config");

  while(FCGI_Accept() >= 0) {
    if(!webservice->process_url_request()) {
      webservice->show_api();
    }
    webservice->disconnect();
  }
}


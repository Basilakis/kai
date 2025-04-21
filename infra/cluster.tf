data "digitalocean_kubernetes_versions" "version" {
  version_prefix = "1.32."
}

resource "digitalocean_kubernetes_cluster" "default" {
  name    = "kai"
  region  = "ams3"
  version = data.digitalocean_kubernetes_versions.version.latest_version

  node_pool {
    name       = "default-pool"
    size       = "s-2vcpu-4gb"
    auto_scale = true
    min_nodes  = 1
    max_nodes  = 5
  }
}

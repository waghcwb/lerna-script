const {loadPackages, iter, fs} = require('lerna-script'),
  gitRemoteUrl = require('git-remote-url'),
  gitInfo = require('hosted-git-info'),
  {relative} = require('path')

function sortByKey(obj) {
  const sorted = {}
  Object.keys(obj)
    .sort()
    .forEach(key => (sorted[key] = obj[key]))
  return sorted
}

function sortDependencies(deps) {
  if (deps) {
    return sortByKey(deps)
  }
}

function npmfix({packages} = {}) {
  return async log => {
    const lernaPackages = await (packages || loadPackages())
    log.info('npmfix', `fixing homepage, repo urls for ${lernaPackages.length} packages`)

    return gitRemoteUrl('.', 'origin').then(gitRemoteUrl => {
      const info = gitInfo.fromUrl(gitRemoteUrl)
      const browseUrl = info.browse()
      const repoUrl = info.ssh()

      return iter.parallel(lernaPackages, {log})((lernaPackage, log) => {
        const moduleRelativePath = relative(process.cwd(), lernaPackage.location)

        return fs
          .readFile(lernaPackage, {log})('package.json', JSON.parse)
          .then(packageJson => {
            const updated = Object.assign({}, packageJson, {
              homepage: browseUrl + '/tree/master/' + moduleRelativePath,
              dependencies: sortDependencies(packageJson.dependencies),
              devDependencies: sortDependencies(packageJson.devDependencies),
              peerDependencies: sortDependencies(packageJson.peerDependencies),
              repository: {
                type: 'git',
                url: repoUrl,
                ...(moduleRelativePath && {directory: '/' + moduleRelativePath})
              }
            })
            return fs.writeFile(lernaPackage, {log})('package.json', updated)
          })
      })
    })
  }
}

module.exports = npmfix

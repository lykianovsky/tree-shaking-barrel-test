async function navigate(page: string) {
  switch (page) {
    case 'page1':
      await import('./page1')
      break
    case 'page2':
      await import('./page2')
      break
    case 'page3':
      await import('./page3')
      break
  }
}

navigate('page1').then(() => navigate('page2'))

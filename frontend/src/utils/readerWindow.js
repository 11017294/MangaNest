export const estimatePageHeight = (page, viewportWidth) => {
  if (page?.width > 0 && page?.height > 0) {
    return Math.max(160, Math.round((viewportWidth * page.height) / page.width))
  }
  return Math.max(320, Math.round(viewportWidth * 4 / 3))
}

export const buildReaderWindow = ({
  pages,
  scrollTop,
  viewportHeight,
  viewportWidth,
  overscan = 900
}) => {
  const heights = pages.map((page) => estimatePageHeight(page, viewportWidth))
  const rangeStart = Math.max(0, scrollTop - overscan)
  const rangeEnd = scrollTop + viewportHeight + overscan
  const visiblePages = []
  let topSpacer = 0
  let bottomSpacer = 0
  let offset = 0

  pages.forEach((page, index) => {
    const height = heights[index]
    const pageStart = offset
    const pageEnd = offset + height
    const isVisible = pageEnd >= rangeStart && pageStart <= rangeEnd

    if (isVisible) {
      visiblePages.push({
        ...page,
        estimatedHeight: height,
        virtualIndex: index
      })
    } else if (pageEnd < rangeStart) {
      topSpacer += height
    } else {
      bottomSpacer += height
    }

    offset += height
  })

  return {
    visiblePages,
    topSpacer,
    bottomSpacer,
    totalHeight: offset
  }
}
